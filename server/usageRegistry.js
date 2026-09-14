const crypto = require('crypto')
const path = require('path')
const fsPromises = require('fs').promises
const { MongoClient } = require('mongodb')

const DEFAULT_FILES_BASE_URL = 'https://cloud.escalion.ru/uploads/'
const DEFAULT_MAX_AGE_DAYS = 7
const MAX_FILES_PER_REPORT = 50000
const PROJECT_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/
const ENVIRONMENT_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/

let databasePromise
let indexesPromise

const getDatabase = async () => {
  const uri = (process.env.MONGODB_URI || '').trim()
  if (!uri) {
    const error = new Error('MONGODB_URI is not set')
    error.code = 'MONGODB_NOT_CONFIGURED'
    throw error
  }

  if (!databasePromise) {
    const parsedTimeout = Number.parseInt(
      process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      10,
    )
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS:
        Number.isFinite(parsedTimeout) && parsedTimeout > 0
          ? parsedTimeout
          : 5000,
    })
    databasePromise = client
      .connect()
      .then((connectedClient) =>
        connectedClient.db(process.env.MONGODB_DB_NAME || 'cloud'),
      )
      .catch((error) => {
        databasePromise = null
        throw error
      })
  }

  const database = await databasePromise
  if (!indexesPromise) {
    indexesPromise = Promise.all([
      database
        .collection('usage_projects')
        .createIndex({ key: 1 }, { unique: true }),
      database
        .collection('usage_reports')
        .createIndex({ project: 1, environment: 1 }, { unique: true }),
      database.collection('usage_reports').createIndex({ receivedAt: 1 }),
    ]).catch((error) => {
      indexesPromise = null
      throw error
    })
  }
  await indexesPromise
  return database
}

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex')

const tokensMatch = (token, tokenHash) => {
  if (!token || !tokenHash) return false
  const actual = Buffer.from(hashToken(token), 'hex')
  const expected = Buffer.from(tokenHash, 'hex')
  return (
    actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  )
}

const normalizeProjectKey = (value) =>
  (value || '').toString().trim().toLowerCase()

const normalizeEnvironment = (value) =>
  (value || '').toString().trim().toLowerCase()

const normalizeEnvironments = (value) => {
  const environments = Array.isArray(value) ? value : ['production']
  return Array.from(
    new Set(environments.map(normalizeEnvironment).filter(Boolean)),
  )
}

const getFilesBaseUrl = () => {
  const publicBaseUrl = (process.env.PUBLIC_BASE_URL || '').trim()
  const raw = (
    process.env.FILES_BASE_URL ||
    (publicBaseUrl ? `${publicBaseUrl.replace(/\/+$/, '')}/uploads/` : '') ||
    DEFAULT_FILES_BASE_URL
  ).trim()
  return raw.endsWith('/') ? raw : `${raw}/`
}

const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(value)
  } catch (error) {
    return value
  }
}

const normalizeUsagePath = (value) => {
  if (typeof value !== 'string') return ''
  let raw = value.trim()
  if (!raw || raw.includes('\u0000')) return ''

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      const baseUrl = new URL(getFilesBaseUrl())
      const basePath = baseUrl.pathname.endsWith('/')
        ? baseUrl.pathname
        : `${baseUrl.pathname}/`
      if (url.origin !== baseUrl.origin || !url.pathname.startsWith(basePath)) {
        return ''
      }
      raw = url.pathname.slice(basePath.length)
    } catch (error) {
      return ''
    }
  } else {
    raw = raw.split(/[?#]/, 1)[0]
    raw = raw.replace(/^\/+uploads\//i, '')
  }

  raw = safeDecodeURIComponent(raw).replace(/\\/g, '/').replace(/^\/+/, '')
  const normalized = path.posix.normalize(raw)
  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.startsWith('/')
  ) {
    return ''
  }
  return normalized
}

const normalizeFiles = (files) => {
  if (!Array.isArray(files)) return null
  if (files.length > MAX_FILES_PER_REPORT) return null
  return Array.from(new Set(files.map(normalizeUsagePath).filter(Boolean))).sort()
}

const normalizeWarnings = (warnings) => {
  if (!Array.isArray(warnings)) return []
  return warnings.slice(0, 100).map((warning) => {
    if (typeof warning === 'string') return warning.slice(0, 1000)
    return {
      source: (warning?.source || '').toString().slice(0, 500),
      message: (warning?.message || '').toString().slice(0, 1000),
    }
  })
}

const normalizeStats = (stats, uniqueFiles) => ({
  documentsScanned: Number.isFinite(stats?.documentsScanned)
    ? Math.max(0, Math.floor(stats.documentsScanned))
    : null,
  linksFound: Number.isFinite(stats?.linksFound)
    ? Math.max(0, Math.floor(stats.linksFound))
    : null,
  uniqueFiles,
})

const readAllUploadedFiles = async (uploadsRoot) => {
  const files = []

  const visit = async (directoryPath, relativeDirectory = '') => {
    let entries
    try {
      entries = await fsPromises.readdir(directoryPath, { withFileTypes: true })
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }

    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name
      const absolutePath = path.join(directoryPath, entry.name)
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath)
      } else if (entry.isFile()) {
        const stats = await fsPromises.stat(absolutePath)
        files.push({
          path: relativePath.replace(/\\/g, '/'),
          size: stats.size,
          modified: stats.mtimeMs,
        })
      }
    }
  }

  await visit(uploadsRoot)
  return files
}

const getReportMaxAgeDays = () => {
  const parsed = Number.parseInt(process.env.USAGE_REPORT_MAX_AGE_DAYS, 10)
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_AGE_DAYS
}

const sendDatabaseError = (res, error) => {
  const notConfigured = error?.code === 'MONGODB_NOT_CONFIGURED'
  res.status(notConfigured ? 503 : 500).json({
    status: 'error',
    message: notConfigured
      ? 'MongoDB для проверки использования не настроена'
      : 'Ошибка MongoDB',
  })
}

const registerUsageRoutes = (app, { isAuthorized, uploadsRoot }) => {
  app.post('/api/usage/projects', async (req, res) => {
    if (!isAuthorized(req)) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' })
      return
    }

    const key = normalizeProjectKey(req.body?.project || req.body?.key)
    const environments = normalizeEnvironments(req.body?.environments)
    if (
      !PROJECT_KEY_PATTERN.test(key) ||
      !environments.length ||
      environments.some((item) => !ENVIRONMENT_PATTERN.test(item))
    ) {
      res.status(400).json({
        status: 'error',
        message: 'Некорректный проект или список окружений',
      })
      return
    }

    try {
      const database = await getDatabase()
      const existing = await database
        .collection('usage_projects')
        .findOne({ key })
      if (existing) {
        res.status(409).json({
          status: 'error',
          message: 'Проект уже зарегистрирован',
        })
        return
      }

      const token = crypto.randomBytes(32).toString('base64url')
      const now = new Date()
      await database.collection('usage_projects').insertOne({
        key,
        name: (req.body?.name || key).toString().trim().slice(0, 120),
        enabled: true,
        environments,
        tokenHash: hashToken(token),
        createdAt: now,
        updatedAt: now,
      })
      res.status(201).json({
        status: 'ok',
        project: key,
        environments,
        token,
        message: 'Сохраните токен: повторно он показан не будет',
      })
    } catch (error) {
      sendDatabaseError(res, error)
    }
  })

  app.get('/api/usage/projects', async (req, res) => {
    if (!isAuthorized(req)) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' })
      return
    }

    try {
      const database = await getDatabase()
      const projects = await database
        .collection('usage_projects')
        .find({}, { projection: { tokenHash: 0 } })
        .sort({ key: 1 })
        .toArray()
      res.json({ status: 'ok', projects })
    } catch (error) {
      sendDatabaseError(res, error)
    }
  })

  app.post('/api/usage/projects/:project/rotate-token', async (req, res) => {
    if (!isAuthorized(req)) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' })
      return
    }

    const key = normalizeProjectKey(req.params.project)
    if (!PROJECT_KEY_PATTERN.test(key)) {
      res.status(400).json({ status: 'error', message: 'Некорректный проект' })
      return
    }

    try {
      const database = await getDatabase()
      const token = crypto.randomBytes(32).toString('base64url')
      const result = await database.collection('usage_projects').updateOne(
        { key },
        { $set: { tokenHash: hashToken(token), updatedAt: new Date() } },
      )
      if (!result.matchedCount) {
        res.status(404).json({ status: 'error', message: 'Проект не найден' })
        return
      }
      res.json({
        status: 'ok',
        project: key,
        token,
        message: 'Сохраните новый токен: повторно он показан не будет',
      })
    } catch (error) {
      sendDatabaseError(res, error)
    }
  })

  app.post('/api/usage/report', async (req, res) => {
    const project = normalizeProjectKey(req.body?.project)
    const environment = normalizeEnvironment(req.body?.environment)
    const token = (req.headers['x-usage-token'] || '').toString().trim()
    const files = normalizeFiles(req.body?.files)

    if (
      !PROJECT_KEY_PATTERN.test(project) ||
      !ENVIRONMENT_PATTERN.test(environment) ||
      !files
    ) {
      res.status(400).json({
        status: 'error',
        message: 'Некорректный формат отчёта',
      })
      return
    }

    try {
      const database = await getDatabase()
      const registeredProject = await database
        .collection('usage_projects')
        .findOne({ key: project, enabled: true })
      if (
        !registeredProject ||
        !registeredProject.environments.includes(environment) ||
        !tokensMatch(token, registeredProject.tokenHash)
      ) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' })
        return
      }

      const scannedAt = new Date(req.body?.scannedAt)
      if (Number.isNaN(scannedAt.getTime())) {
        res.status(400).json({
          status: 'error',
          message: 'scannedAt должен быть датой ISO 8601',
        })
        return
      }

      const inventory = await readAllUploadedFiles(uploadsRoot)
      const inventoryPaths = new Set(inventory.map((file) => file.path))
      const unknownFiles = files.filter((filePath) => !inventoryPaths.has(filePath))
      const receivedAt = new Date()
      await database.collection('usage_reports').findOneAndUpdate(
        { project, environment },
        {
          $set: {
            project,
            environment,
            scannedAt,
            receivedAt,
            files,
            warnings: normalizeWarnings(req.body?.warnings),
            stats: normalizeStats(req.body?.stats, files.length),
          },
        },
        { upsert: true },
      )

      res.json({
        status: 'ok',
        project,
        environment,
        registeredFiles: files.length,
        unknownFiles,
      })
    } catch (error) {
      sendDatabaseError(res, error)
    }
  })

  app.get('/api/usage/audit', async (req, res) => {
    if (!isAuthorized(req)) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' })
      return
    }

    try {
      const database = await getDatabase()
      const [projects, reports, inventory] = await Promise.all([
        database
          .collection('usage_projects')
          .find({ enabled: true }, { projection: { tokenHash: 0 } })
          .sort({ key: 1 })
          .toArray(),
        database.collection('usage_reports').find({}).toArray(),
        readAllUploadedFiles(uploadsRoot),
      ])

      const maxAgeDays = getReportMaxAgeDays()
      const staleBefore = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
      const reportsByKey = new Map(
        reports.map((report) => [
          `${report.project}:${report.environment}`,
          report,
        ]),
      )
      const requiredReports = projects.flatMap((project) =>
        project.environments.map((environment) => {
          const report = reportsByKey.get(`${project.key}:${environment}`)
          const receivedAt = report?.receivedAt
            ? new Date(report.receivedAt).getTime()
            : 0
          return {
            project: project.key,
            name: project.name,
            environment,
            status: !report
              ? 'missing'
              : receivedAt < staleBefore
                ? 'stale'
                : report.warnings?.length
                  ? 'warning'
                  : 'fresh',
            scannedAt: report?.scannedAt || null,
            receivedAt: report?.receivedAt || null,
            fileCount: report?.files?.length || 0,
            warnings: report?.warnings || [],
          }
        }),
      )

      const activeProjectKeys = new Set(projects.map((project) => project.key))
      const relevantReports = reports.filter((report) =>
        activeProjectKeys.has(report.project),
      )
      const references = new Map()
      for (const report of relevantReports) {
        for (const filePath of report.files || []) {
          if (!references.has(filePath)) references.set(filePath, [])
          references.get(filePath).push({
            project: report.project,
            environment: report.environment,
          })
        }
      }

      const inventoryPaths = new Set(inventory.map((file) => file.path))
      const usedFiles = []
      const unusedFiles = []
      for (const file of inventory) {
        const usedBy = references.get(file.path) || []
        if (usedBy.length) usedFiles.push({ ...file, usedBy })
        else unusedFiles.push(file)
      }
      const missingFiles = Array.from(references.entries())
        .filter(([filePath]) => !inventoryPaths.has(filePath))
        .map(([filePath, usedBy]) => ({ path: filePath, usedBy }))

      const sumSizes = (files) =>
        files.reduce((total, file) => total + (file.size || 0), 0)
      const complete =
        requiredReports.length > 0 &&
        requiredReports.every((report) => report.status === 'fresh')

      res.json({
        status: 'ok',
        generatedAt: new Date(),
        maxAgeDays,
        complete,
        safeToClean: complete,
        projects: requiredReports,
        summary: {
          totalFiles: inventory.length,
          totalSize: sumSizes(inventory),
          usedFiles: usedFiles.length,
          usedSize: sumSizes(usedFiles),
          unusedFiles: unusedFiles.length,
          unusedSize: sumSizes(unusedFiles),
          missingFiles: missingFiles.length,
        },
        usedFiles,
        unusedFiles,
        missingFiles,
      })
    } catch (error) {
      sendDatabaseError(res, error)
    }
  })
}

module.exports = {
  registerUsageRoutes,
  normalizeUsagePath,
}
