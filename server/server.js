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
    origin: [
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
      'escalioncloud.ru',
      'www.escalioncloud.ru',
      'https://artistcrm.ru',
      'https://www.artistcrm.ru',
      'https://actquest.ru',
      'https://www.actquest.ru',
      'http://localhost:3000',
    ],
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
  res.status(500).send('Something broke!')
})

var pathFolder
var urls = []

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
    const { password } = req.body
    // console.log('project', project)
    // console.log('folder', folder)
    // console.log('password', password)
    // console.log('process.env.PASSWORD', process.env.PASSWORD)
    // if (!!password && password === process.env.PASSWORD) {
    pathFolder = buildPathFolder(req.body)
    const serverPath = `${__dirname}/../client/temp`
    // const serverPath = `${__dirname}/../client/uploads/${pathFolder}`
    // console.log('req.headers', req.headers)
    // fs.mkdirSync(serverPath, { recursive: true })
    const targetDir = pathFolder
      ? `${__dirname}/../client/uploads/${pathFolder}`
      : `${__dirname}/../client/uploads`
    fs.mkdirSync(targetDir, {
      recursive: true,
    })
    callback(null, serverPath)
    // } else {
    //   callback('Wrong password')
    // }
  },
  // Sets file(s) to be saved in uploads folder in same directory
  filename: function (req, file, callback) {
    const randomPart = uuidv4()
    const extension = normalizeExtension(file)
    const newFileName = `${randomPart}.${extension}`
    const storedPath = pathFolder
      ? `${pathFolder}/${newFileName}`
      : newFileName
    urls.push(storedPath)
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
          }
        })
        .filter((item) => (noFolders ? item.isFile : true))
      res.json(mapped)
    })
  else res.json([])
})

app.get('/api/deletefile', (req, res) => {
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

app.post('/api', upload.single('files'), async (req, res) => {
  // console.log('req.body', req.body)
  // const protocol = req.protocol
  // const host = req.hostname
  // const url = req.originalUrl
  // const port = process.env.PORT || PORT

  // formData.append('password', 'cloudtest')

  // ------This from client ------
  // formData.append('project', project ?? 'polovinka_uspeha')
  // formData.append('folder', folder ?? 'temp')
  // formData.append('fileType', 'file')
  // formData.append('files', file)
  // formData.append('fileName', fileName)
  // -----------------------------

  // const domain = `${protocol}://${host}`
  // Sets multer to intercept files named "files" on uploaded form data
  // console.log('req.headers2', req.headers)
  // console.log(req.body) // Logs form body values
  // console.log(req.files) // Logs any files
  // await imageUpload(req)
  const { filename } = req.file
  const extension = path.extname(filename).replace('.', '').toLowerCase()
  const isDocument = docExtensions.has(extension)
  if (isDocument) {
    const docLimitBytes = getDocMaxBytes()
    if (req.file.size > docLimitBytes) {
      fs.unlinkSync(req.file.path)
      res.status(413).json({
        status: 'error',
        message: 'Файл превышает лимит',
        maxBytes: docLimitBytes,
      })
      return
    }
  }
  const destinationPath = path.resolve(
    req.file.destination,
    '../uploads/',
    pathFolder,
    filename,
  )
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

  const urlsToSend = urls.map(
    (url) => `https://escalioncloud.ru/uploads/${url}`,
  )
  urls = []
  console.log('urlsToSend', urlsToSend)
  res.json(urlsToSend)
  // res.json(true)
})

app.listen(5000, function () {
  console.log('Server running on port 5000')
})
