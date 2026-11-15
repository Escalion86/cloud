const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const multer = require('multer')

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCESS_URL_TTL_SECONDS = 5 * 60
const PRIVATE_FILE_STORAGE_PREFIXES = new Set(['vedelo', 'artistcrm'])
const ALLOWED_TYPES = new Map([
  ['pdf', new Set(['application/pdf'])],
  ['doc', new Set(['application/msword'])],
  ['docx', new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])],
  ['xls', new Set(['application/vnd.ms-excel'])],
  ['xlsx', new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])],
  ['csv', new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel'])],
  ['txt', new Set(['text/plain'])],
  ['jpg', new Set(['image/jpeg'])],
  ['jpeg', new Set(['image/jpeg'])],
  ['png', new Set(['image/png'])],
  ['webp', new Set(['image/webp'])],
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_FILE_SIZE },
})

const errorResponse = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message } })

const normalizeUploadId = (value) => {
  const uploadId = String(value || '').trim()
  return /^[a-zA-Z0-9_-]{1,80}$/.test(uploadId) ? uploadId : ''
}

// Vedelo sends a key ending at uploadId (six segments). The artistcrm root is
// retained for already stored files and signed links created before rebranding.
const normalizeEntityStorageKey = (value) => {
  const storageKey = String(value || '').trim().replace(/^\/+|\/+$/g, '')
  if (storageKey.includes('..') || /[\\\u0000-\u001f]/.test(storageKey)) return ''
  const segments = storageKey.split('/')
  if (
    segments.length !== 6 ||
    !PRIVATE_FILE_STORAGE_PREFIXES.has(segments[0]) ||
    !/^[a-f0-9]{24}$/i.test(segments[1]) ||
    !['events', 'clients'].includes(segments[2]) ||
    !/^[a-f0-9]{24}$/i.test(segments[3]) ||
    segments[4] !== 'documents' ||
    !normalizeUploadId(segments[5])
  ) {
    return ''
  }
  return storageKey
}

const normalizeArtistCrmStorageKey = normalizeEntityStorageKey

const sanitizeName = (value) => {
  const name = String(value || 'file')
    .split(/[\\/]/)
    .pop()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 180)
  return name || 'file'
}

const resolveInside = (root, relativePath) => {
  const resolvedRoot = path.resolve(root)
  const target = path.resolve(resolvedRoot, relativePath)
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
    return ''
  }
  return target
}

const validateFile = (file) => {
  if (!file) return { code: 'FILE_REQUIRED', message: 'Файл не передан' }
  if (!file.size) return { code: 'FILE_EMPTY', message: 'Нельзя загрузить пустой файл' }
  if (file.size > MAX_FILE_SIZE) {
    return { code: 'FILE_TOO_LARGE', message: 'Файл не должен превышать 5 МБ' }
  }
  const extension = path.extname(file.originalname || '').slice(1).toLowerCase()
  const allowedMimeTypes = ALLOWED_TYPES.get(extension)
  const contentType = String(file.mimetype || '').toLowerCase()
  if (
    !allowedMimeTypes ||
    (contentType && contentType !== 'application/octet-stream' && !allowedMimeTypes.has(contentType))
  ) {
    return {
      code: 'FILE_TYPE_NOT_ALLOWED',
      message: 'Разрешены PDF, DOC/DOCX, XLS/XLSX, CSV, TXT, JPEG, PNG и WebP',
    }
  }
  return { extension, contentType: contentType || 'application/octet-stream' }
}

const readMetadata = async (directory) => {
  try {
    return JSON.parse(await fs.promises.readFile(path.join(directory, 'metadata.json'), 'utf8'))
  } catch {
    return null
  }
}

const getSigningSecret = () => process.env.PRIVATE_FILES_SIGNING_SECRET || process.env.PASSWORD || ''

const buildSignature = ({ storageKey, expires, disposition, downloadName }) =>
  crypto
    .createHmac('sha256', getSigningSecret())
    .update([storageKey, expires, disposition, downloadName].join('\n'))
    .digest('hex')

const signaturesMatch = (left, right) => {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const registerPrivateFileRoutes = (app, { isAuthorized, uploadsRoot }) => {
  app.post('/api/private-files/upload', (req, res) => {
    upload.single('file')(req, res, async (uploadError) => {
      if (!isAuthorized(req)) return errorResponse(res, 401, 'UNAUTHORIZED', 'Не авторизован')
      if (uploadError?.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 413, 'FILE_TOO_LARGE', 'Файл не должен превышать 5 МБ')
      }
      if (uploadError) return errorResponse(res, 400, 'FILE_REQUIRED', 'Не удалось принять файл')
      const storageKey = normalizeEntityStorageKey(req.body?.storageKey)
      const uploadId = normalizeUploadId(req.body?.uploadId)
      if (!storageKey) return errorResponse(res, 400, 'STORAGE_KEY_INVALID', 'Некорректный ключ хранения')
      if (!uploadId || !storageKey.endsWith(`/${uploadId}`)) {
        return errorResponse(res, 400, 'UPLOAD_ID_INVALID', 'Некорректный идентификатор загрузки')
      }
      const validation = validateFile(req.file)
      if (validation.code) {
        const status = validation.code === 'FILE_TOO_LARGE' ? 413 : validation.code === 'FILE_TYPE_NOT_ALLOWED' ? 415 : 400
        return errorResponse(res, status, validation.code, validation.message)
      }
      const directory = resolveInside(uploadsRoot, `.private/${storageKey}`)
      if (!directory) return errorResponse(res, 400, 'STORAGE_KEY_INVALID', 'Некорректный ключ хранения')
      try {
        const existing = await readMetadata(directory)
        if (existing?.uploadId === uploadId) {
          return res.json({ success: true, data: existing })
        }
        await fs.promises.mkdir(directory, { recursive: true })
        const fileName = `content.${validation.extension}`
        const filePath = resolveInside(directory, fileName)
        const checksum = `sha256:${crypto.createHash('sha256').update(req.file.buffer).digest('hex')}`
        const metadata = {
          storageKey,
          uploadId,
          name: sanitizeName(req.file.originalname),
          storedName: fileName,
          size: req.file.size,
          contentType: validation.contentType,
          checksum,
          createdAt: new Date().toISOString(),
        }
        await fs.promises.writeFile(filePath, req.file.buffer, { flag: 'wx' }).catch(async (error) => {
          if (error.code !== 'EEXIST') throw error
        })
        await fs.promises.writeFile(path.join(directory, 'metadata.json'), JSON.stringify(metadata), 'utf8')
        return res.json({ success: true, data: metadata })
      } catch {
        return errorResponse(res, 503, 'STORAGE_UNAVAILABLE', 'Хранилище временно недоступно')
      }
    })
  })

  app.post('/api/private-files/access-url', async (req, res) => {
    if (!isAuthorized(req)) return errorResponse(res, 401, 'UNAUTHORIZED', 'Не авторизован')
    const storageKey = normalizeEntityStorageKey(req.body?.storageKey)
    if (!storageKey) return errorResponse(res, 400, 'STORAGE_KEY_INVALID', 'Некорректный ключ хранения')
    const directory = resolveInside(uploadsRoot, `.private/${storageKey}`)
    const metadata = await readMetadata(directory)
    if (!metadata) return errorResponse(res, 404, 'FILE_NOT_FOUND', 'Файл не найден')
    const disposition = req.body?.disposition === 'inline' ? 'inline' : 'attachment'
    const downloadName = sanitizeName(req.body?.downloadName || metadata.name)
    const expires = Math.floor(Date.now() / 1000) + ACCESS_URL_TTL_SECONDS
    const signature = buildSignature({ storageKey, expires, disposition, downloadName })
    const baseUrl = String(process.env.PUBLIC_BASE_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.get('host')}`).replace(/\/+$/, '')
    const search = new URLSearchParams({ storageKey, expires: String(expires), disposition, downloadName, signature })
    return res.json({
      success: true,
      data: {
        url: `${baseUrl}/api/private-files/content?${search}`,
        expiresAt: new Date(expires * 1000).toISOString(),
      },
    })
  })

  app.get('/api/private-files/content', async (req, res) => {
    const storageKey = normalizeEntityStorageKey(req.query.storageKey)
    const expires = Number(req.query.expires)
    const disposition = req.query.disposition === 'inline' ? 'inline' : 'attachment'
    const downloadName = sanitizeName(req.query.downloadName)
    const expected = buildSignature({ storageKey, expires, disposition, downloadName })
    if (!storageKey || !Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000) || !signaturesMatch(req.query.signature, expected)) {
      return errorResponse(res, 403, 'UNAUTHORIZED', 'Ссылка недействительна или истекла')
    }
    const directory = resolveInside(uploadsRoot, `.private/${storageKey}`)
    const metadata = await readMetadata(directory)
    const filePath = metadata ? resolveInside(directory, metadata.storedName) : ''
    if (!filePath || !fs.existsSync(filePath)) return errorResponse(res, 404, 'FILE_NOT_FOUND', 'Файл не найден')
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream')
    res.setHeader('Content-Length', String(metadata.size || 0))
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Disposition', `${disposition}; filename="download"; filename*=UTF-8''${encodeURIComponent(downloadName)}`)
    return fs.createReadStream(filePath).pipe(res)
  })

  app.delete('/api/private-files', async (req, res) => {
    if (!isAuthorized(req)) return errorResponse(res, 401, 'UNAUTHORIZED', 'Не авторизован')
    const storageKey = normalizeEntityStorageKey(req.body?.storageKey)
    const deleteId = normalizeUploadId(req.body?.deleteId)
    if (!storageKey) return errorResponse(res, 400, 'STORAGE_KEY_INVALID', 'Некорректный ключ хранения')
    if (!deleteId) return errorResponse(res, 400, 'UPLOAD_ID_INVALID', 'Некорректный идентификатор удаления')
    const directory = resolveInside(uploadsRoot, `.private/${storageKey}`)
    try {
      await fs.promises.rm(directory, { recursive: true, force: true })
      return res.json({ success: true, data: { deleted: true } })
    } catch {
      return errorResponse(res, 503, 'STORAGE_UNAVAILABLE', 'Не удалось удалить файл')
    }
  })
}

module.exports = {
  ACCESS_URL_TTL_SECONDS,
  MAX_FILE_SIZE,
  buildSignature,
  normalizeEntityStorageKey,
  normalizeArtistCrmStorageKey,
  registerPrivateFileRoutes,
  sanitizeName,
  validateFile,
}
