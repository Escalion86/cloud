const express = require('express')
const multer = require('multer')
const cors = require('cors')
const fs = require('fs')
const sharp = require('sharp')
const path = require('path')
const fsPromises = require('fs').promises

const { v4: uuidv4 } = require('uuid')
require('dotenv').config()
// console.log(process.env) // remove this after you've confirmed it is working
// var corsOptions = {
//   origin: 'http://example.com',
//   optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
// }

var app = express()
app.use(
  '/uploads',
  express.static(path.resolve(__dirname, '../client/uploads')),
)

const normalizeOrigin = (value) =>
  (value || '').toString().trim().replace(/\/+$/g, '')

const expandOriginEntry = (value) => {
  const normalized = normalizeOrigin(value)
  if (!normalized) return []
  if (/^https?:\/\//i.test(normalized)) return [normalized]
  return [`https://${normalized}`, `http://${normalized}`]
}

const getPublicBaseUrl = (req) => {
  const fromEnv = normalizeOrigin(process.env.PUBLIC_BASE_URL)
  if (fromEnv) return fromEnv
  const protocol = req?.headers?.['x-forwarded-proto'] || req?.protocol || 'http'
  const host = req?.headers?.['x-forwarded-host'] || req?.get?.('host') || 'localhost:5000'
  return normalizeOrigin(`${protocol}://${host}`)
}

const allowedOrigins = new Set(
  [
    'http://www.xn--80aaennmesfbiiz1a7a.xn--p1ai',
    'http://xn--80aaennmesfbiiz1a7a.xn--p1ai',
    'https://www.xn--80aaennmesfbiiz1a7a.xn--p1ai',
    'https://xn--80aaennmesfbiiz1a7a.xn--p1ai',
    'http://www.nrsk.xn--80aaennmesfbiiz1a7a.xn--p1ai',
    'http://nrsk.xn--80aaennmesfbiiz1a7a.xn--p1ai',
    'https://www.nrsk.xn--80aaennmesfbiiz1a7a.xn--p1ai',
    'https://nrsk.xn--80aaennmesfbiiz1a7a.xn--p1ai',
    'https://www.dev.xn--80aaennmesfbiiz1a7a.xn--p1ai',
    'https://dev.xn--80aaennmesfbiiz1a7a.xn--p1ai',
    process.env.PUBLIC_BASE_URL,
    'https://artistcrm.ru',
    'https://www.artistcrm.ru',
    'https://actquest.ru',
    'https://www.actquest.ru',
    'http://localhost:3000',
  ]
    .flatMap(expandOriginEntry)
    .map(normalizeOrigin),
)

const extractBearerToken = (authorization) => {
  if (!authorization) return ''
  const raw = authorization.toString().trim()
  const match = raw.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : raw
}

const isAuthorized = (req) => {
  const authValue =
    req.query.password ||
    req.body?.password ||
    req.headers['x-api-password'] ||
    req.headers['x-token'] ||
    extractBearerToken(req.headers.authorization)
  return Boolean(process.env.PASSWORD) && authValue === process.env.PASSWORD
}

const getErrorReason = (error, fallback) => {
  if (!error) return fallback
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return 'Файл превышает допустимый размер'
    }
    return error.message || `Multer error: ${error.code}`
  }
  if (typeof error === 'string') return error
  return error.message || fallback
}

const logApiError = (scope, error) => {
  const name = error?.name || 'Error'
  const code = error?.code || 'UNKNOWN'
  const message = error?.message || String(error)
  console.error(`[${scope}] ${name} (${code}): ${message}`)
  if (error?.stack) {
    console.error(error.stack)
  }
}

const sendUploadResponse = (req, res, statusCode, payload) => {
  const jsonPayload =
    statusCode >= 200 &&
    statusCode < 300 &&
    typeof payload !== 'undefined' &&
    Object.prototype.hasOwnProperty.call(payload, 'data')
      ? payload.data
      : payload
  res.status(statusCode).json(jsonPayload)
}

// app.use((req, res, next) => {
//   const actualOrigin = req.headers.origin
//   if (['Content-Type'].includes(actualOrigin)) {
//     res.setHeader('Access-Control-Allow-Origin', actualOrigin)
//   } else {
//     return res.status(403).send('Unauthorized Origin')
//   }
//   res.setHeader(
//     'Access-Control-Allow-Methods',
//     'GET,POST,PATCH,DELETE,OPTIONS,PUT'
//   )
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
//   if (req.method === 'OPTIONS') {
//     res.sendStatus(200)
//   } else {
//     next()
//   }
// })

app.use(
  cors({
    allowedHeaders: [
      // 'authorization',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
      'Accept',
      'Origin',
      'Cache-Control',
      'Content-Type',
      // 'X-Token',
      // 'X-Refresh-Token',
    ], // you can change the headers
    // exposedHeaders: ['authorization'], // you can change the headers
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true)
        return
      }
      const normalized = normalizeOrigin(origin)
      if (
        allowedOrigins.has(normalized) ||
        /^http:\/\/localhost:\d+$/i.test(normalized)
      ) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'))
    },
    // headers: [
    //   'Origin',
    //   // 'X-Requested-With',
    //   'Content-Type',
    //   'Accept',
    //   'Access-Control-Allow-Headers',
    //   'Access-Control-Allow-Origin',
    // ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: true,
  }),
) // Allows incoming requests from any I

app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    reason: getErrorReason(err, 'Unhandled error'),
  })
})

// Start by creating some disk storage options:
const mimeExtensionMap = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
}

const normalizeExtension = (file) => {
  const originalExt = path.extname(file.originalname || '')
    .replace('.', '')
    .toLowerCase()
  if (originalExt) return originalExt
  return mimeExtensionMap[file.mimetype] || 'bin'
}

const normalizeRequestedExtension = (value) => {
  const normalized = (value || '').toString().trim().replace(/^\./, '').toLowerCase()
  if (!normalized) return ''
  return normalized.replace(/[^a-z0-9]/g, '')
}

const normalizeRequestedFileName = (value) => {
  const raw = (value || '').toString().trim()
  if (!raw) return ''
  const baseName = path.parse(path.basename(raw)).name.trim()
  if (!baseName) return ''
  const withoutForbiddenChars = baseName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').trim()
  return withoutForbiddenChars.replace(/\.+$/g, '').trim()
}

const decodeMulterOriginalName = (value) => {
  const raw = (value || '').toString()
  if (!raw) return ''
  try {
    const decoded = Buffer.from(raw, 'latin1').toString('utf8')
    if (!decoded || decoded.includes('\uFFFD')) return raw
    return decoded
  } catch (error) {
    return raw
  }
}

const parseBooleanFlag = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['true', '1', 'yes', 'on'].includes(normalized)
  }
  return false
}

const normalizePathSegment = (value) =>
  (value || '').toString().replace(/^\/+|\/+$/g, '')

const buildPathFolder = (body) => {
  const directory = normalizePathSegment(body.directory)
  if (directory) return directory
  const project = normalizePathSegment(body.project)
  const folder = normalizePathSegment(body.folder)
  return [project, folder].filter(Boolean).join('/')
}

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    const serverPath = path.resolve(__dirname, '../client/temp')
    try {
      fs.mkdirSync(serverPath, {
        recursive: true,
      })
      callback(null, serverPath)
    } catch (error) {
      callback(error)
    }
  },
  // Sets file(s) to be saved in uploads folder in same directory
  filename: function (req, file, callback) {
    const randomPart = uuidv4()
    const extension = normalizeExtension(file)
    const newFileName = `${randomPart}.${extension}`
    callback(null, newFileName)
  },
  // Sets saved filename(s) to be original filename(s)
})

// Set saved storage options:
const docExtensions = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
])

const getAllowedExtensions = () => {
  const raw = (process.env.ALLOWED_EXTENSIONS || '').trim()
  if (!raw) return null
  return new Set(
    raw
      .split(',')
      .map((item) => item.trim().replace('.', '').toLowerCase())
      .filter(Boolean),
  )
}

const getDocMaxBytes = () => {
  const fallbackMb = 20
  const parsed = Number.parseFloat(process.env.DOC_MAX_MB)
  const mb = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMb
  return Math.floor(mb * 1024 * 1024)
}

var maxSize = 100 * 1024 * 1024 * 1024
const upload = multer({ storage, limits: { fileSize: maxSize } })

// const resizer = new MulterResizer({
//   multer: upload,
//   tasks: [
//     {
//       resize: {
//         width: 2400,
//         height: 2400,
//         format: 'jpg',
//         // suffix: 'resized-big'
//       },
//     },
//   ],
// })

// app.get('*', function (req, res) {
//   const protocol = req.protocol
//   const host = req.hostname
//   const url = req.originalUrl
//   const port = process.env.PORT || PORT

//   const fullUrl = `${protocol}://${host}:${port}${url}`

//   const responseString = `Full URL is: ${fullUrl}`
//   res.send(responseString)
// })

// const imageUpload = async (req) => {
//   ​
//       const formattedFileName = req.file.originalname.split(' ').join('-'); //replace space with -
//       try {
//           await sharp(req.file.buffer)
//           .resize({with:800, height:600}) //max width = 800 or height = 600
//           .toFile('./uploads/'+ formattedFileName); //upload to /upload folder
//   ​
//       } catch (error) {
//           console.log(error);
//       }
//   }

app.get('/api/files', (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' })
    return
  }
  const directory = req.query.directory
  const noFolders = req.query.noFolders
  console.log('req.query :>> ', req.query)
  const directoryPath = `${__dirname}/../client/uploads/${directory}` // Specify the directory path here
  if (fs.existsSync(directoryPath))
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        res.status(500).send('Error reading directory')
        // res.json([])
        return
      }
      const mapped = files
        .map((file) => {
          const fullPath = `${directoryPath}/${file}`
          const stats = fs.statSync(fullPath)
          return {
            name: file,
            isFile: stats.isFile(),
            size: stats.isFile() ? stats.size : 0,
            modified: stats.mtimeMs,
          }
        })
        .filter((item) => (noFolders ? item.isFile : true))
      res.json(mapped)
    })
  else res.json([])
})

app.get('/api/deletefile', (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' })
    return
  }
  const filePath = req.query.filePath

  const directoryFilePath = `${__dirname}/../client/uploads/${filePath}` // Specify the directory path here
  if (fs.existsSync(directoryFilePath)) {
    fs.unlink(directoryFilePath, function (err) {
      if (err) {
        res.status(500).send('Error reading filePath')
        return
        // throw err;
      }
      console.log('File deleted!')
      res.json({ status: 'ok', message: 'File deleted!' })
    })
  }
})

app.delete('/api/deletedir', (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' })
    return
  }
  const directory = req.query.directory

  if (!directory) {
    res.status(400).json({ status: 'error', message: 'directory is required' })
    return
  }

  const uploadsRoot = path.resolve(__dirname, '../client/uploads')
  const targetPath = path.resolve(uploadsRoot, directory)

  if (!targetPath.startsWith(uploadsRoot)) {
    res.status(400).json({ status: 'error', message: 'Invalid directory' })
    return
  }

  if (!fs.existsSync(targetPath)) {
    res.status(404).json({ status: 'error', message: 'Directory not found' })
    return
  }

  fs.rm(targetPath, { recursive: true, force: true }, (err) => {
    if (err) {
      res.status(500).json({ status: 'error', message: 'Error deleting dir' })
      return
    }
    res.json({ status: 'ok', message: 'Directory deleted!' })
  })
})

app.post('/api/createdir', (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' })
    return
  }
  const directory = req.query.directory

  if (!directory) {
    res.status(400).json({ status: 'error', message: 'directory is required' })
    return
  }

  const uploadsRoot = path.resolve(__dirname, '../client/uploads')
  const targetPath = path.resolve(uploadsRoot, directory)

  if (!targetPath.startsWith(uploadsRoot)) {
    res.status(400).json({ status: 'error', message: 'Invalid directory' })
    return
  }

  fs.mkdir(targetPath, { recursive: true }, (err) => {
    if (err) {
      res.status(500).json({ status: 'error', message: 'Error creating dir' })
      return
    }
    res.json({ status: 'ok', message: 'Directory created!' })
  })
})

const getDirectorySize = async (dirPath) => {
  let total = 0
  const entries = await fsPromises.readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      total += await getDirectorySize(fullPath)
    } else if (entry.isFile()) {
      const stats = await fsPromises.stat(fullPath)
      total += stats.size
    }
  }
  return total
}

app.get('/api/dirsize', async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' })
    return
  }
  const directory = req.query.directory

  if (typeof directory === 'undefined') {
    res.status(400).json({ status: 'error', message: 'directory is required' })
    return
  }

  const uploadsRoot = path.resolve(__dirname, '../client/uploads')
  const targetPath = directory
    ? path.resolve(uploadsRoot, directory)
    : uploadsRoot

  if (!targetPath.startsWith(uploadsRoot)) {
    res.status(400).json({ status: 'error', message: 'Invalid directory' })
    return
  }

  try {
    const stats = await fsPromises.stat(targetPath)
    if (!stats.isDirectory()) {
      res
        .status(400)
        .json({ status: 'error', message: 'Not a directory' })
      return
    }
    const size = await getDirectorySize(targetPath)
    res.json({ status: 'ok', size })
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error reading dir' })
  }
})

app.get('/api/disk', async (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' })
    return
  }
  try {
    if (typeof fsPromises.statfs !== 'function') {
      res.status(501).json({ status: 'error', message: 'statfs not supported' })
      return
    }
    const uploadsRoot = path.resolve(__dirname, '../client/uploads')
    const stats = await fsPromises.statfs(uploadsRoot)
    const free = stats.bavail * stats.bsize
    const total = stats.blocks * stats.bsize
    res.json({ status: 'ok', free, total })
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Error reading disk' })
  }
})

app.post('/api/rename', (req, res) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' })
    return
  }
  const targetPath = req.query.path
  const newName = req.query.name

  if (!targetPath || !newName) {
    res.status(400).json({ status: 'error', message: 'path and name required' })
    return
  }

  if (newName.includes('/') || newName.includes('\\')) {
    res.status(400).json({ status: 'error', message: 'Invalid name' })
    return
  }

  const uploadsRoot = path.resolve(__dirname, '../client/uploads')
  const safeTarget = path.resolve(uploadsRoot, targetPath)
  if (!safeTarget.startsWith(uploadsRoot)) {
    res.status(400).json({ status: 'error', message: 'Invalid path' })
    return
  }

  if (!fs.existsSync(safeTarget)) {
    res.status(404).json({ status: 'error', message: 'Not found' })
    return
  }

  const parentDir = path.dirname(safeTarget)
  const nextPath = path.resolve(parentDir, newName)
  if (!nextPath.startsWith(uploadsRoot)) {
    res.status(400).json({ status: 'error', message: 'Invalid target' })
    return
  }

  fs.rename(safeTarget, nextPath, (err) => {
    if (err) {
      res.status(500).json({ status: 'error', message: 'Rename failed' })
      return
    }
    res.json({ status: 'ok', message: 'Renamed' })
  })
})

app.post('/api', (req, res) => {
  upload.single('files')(req, res, async (uploadError) => {
    if (uploadError) {
      logApiError('upload-middleware', uploadError)
      sendUploadResponse(req, res, 400, {
        status: 'error',
        message: 'Ошибка загрузки файла',
        reason: getErrorReason(uploadError, 'Ошибка upload middleware'),
      })
      return
    }

    if (!isAuthorized(req)) {
      sendUploadResponse(req, res, 401, {
        status: 'error',
        message: 'Unauthorized',
        reason: 'Неверный пароль API',
      })
      return
    }

    try {
      if (!req.file) {
        sendUploadResponse(req, res, 400, {
          status: 'error',
          message: 'Файл не передан',
          reason: 'Поле "files" отсутствует в multipart/form-data',
        })
        return
      }

      const fallbackExtension = path.extname(req.file.filename).replace('.', '').toLowerCase()
      const requestedFileName = normalizeRequestedFileName(req.body?.fileName)
      const requestedExtension = normalizeRequestedExtension(req.body?.extension)
      const decodedOriginalName = decodeMulterOriginalName(req.file.originalname)
      const originalBaseName = normalizeRequestedFileName(decodedOriginalName)
      const generateName = parseBooleanFlag(req.body?.generateName)
      const extension = requestedExtension || fallbackExtension
      const fileName = generateName
        ? uuidv4()
        : requestedFileName || originalBaseName || uuidv4()
      const finalFileName = `${fileName}.${extension}`
      const allowedExtensions = getAllowedExtensions()
      if (allowedExtensions && !allowedExtensions.has(extension)) {
        fs.unlinkSync(req.file.path)
        sendUploadResponse(req, res, 415, {
          status: 'error',
          message: 'Недопустимый тип файла',
          reason: `Разрешены: ${Array.from(allowedExtensions).join(', ')}`,
        })
        return
      }
      const isDocument = docExtensions.has(extension)
      if (isDocument) {
        const docLimitBytes = getDocMaxBytes()
        if (req.file.size > docLimitBytes) {
          fs.unlinkSync(req.file.path)
          sendUploadResponse(req, res, 413, {
            status: 'error',
            message: 'Файл превышает лимит',
            maxBytes: docLimitBytes,
            reason: `Размер файла: ${req.file.size} байт`,
          })
          return
        }
      }

      const uploadsRoot = path.resolve(__dirname, '../client/uploads')
      const resolvedDirectory = buildPathFolder(req.body || {})
      const targetDir = resolvedDirectory
        ? path.resolve(uploadsRoot, resolvedDirectory)
        : uploadsRoot

      if (!targetDir.startsWith(uploadsRoot)) {
        fs.unlinkSync(req.file.path)
        sendUploadResponse(req, res, 400, {
          status: 'error',
          message: 'Invalid directory',
          reason: 'Путь выходит за пределы uploads',
        })
        return
      }
      fs.mkdirSync(targetDir, { recursive: true })
      const destinationPath = path.resolve(targetDir, finalFileName)

      const isImage = req.file.mimetype.startsWith('image/')
      const canProcessImage = ['jpg', 'jpeg', 'png', 'webp'].includes(extension)

      if (isImage && canProcessImage) {
        const format = extension === 'jpg' ? 'jpeg' : extension
        await sharp(req.file.path)
          .resize(2400, 2400, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toFormat(format, { quality: 90 })
          .toFile(destinationPath)
        fs.unlinkSync(req.file.path)
      } else {
        fs.renameSync(req.file.path, destinationPath)
      }

      const storedPath = resolvedDirectory
        ? `${resolvedDirectory}/${finalFileName}`
        : finalFileName
      const publicBaseUrl = getPublicBaseUrl(req)
      const urlsToSend = [`${publicBaseUrl}/uploads/${storedPath}`]
      console.log('urlsToSend', urlsToSend)
      sendUploadResponse(req, res, 200, {
        status: 'ok',
        message: 'Файл загружен',
        urls: urlsToSend,
        data: urlsToSend,
      })
    } catch (error) {
      logApiError('upload-handler', error)
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path)
        } catch (unlinkError) {
          logApiError('upload-temp-cleanup', unlinkError)
        }
      }
      sendUploadResponse(req, res, 500, {
        status: 'error',
        message: 'Ошибка загрузки файла',
        reason: getErrorReason(error, 'Неизвестная ошибка'),
      })
    }
  })
})

app.use((error, req, res, next) => {
  logApiError('unhandled', error)
  if (res.headersSent) {
    next(error)
    return
  }
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    reason: getErrorReason(error, 'Unhandled error'),
  })
})

app.listen(5000, function () {
  console.log('Server running on port 5000')
})
