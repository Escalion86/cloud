const express = require('express')
const multer = require('multer')
const cors = require('cors')
const fs = require('fs')
const sharp = require('sharp')
const path = require('path')

const { v4: uuidv4 } = require('uuid')
require('dotenv').config()
// console.log(process.env) // remove this after you've confirmed it is working
// var corsOptions = {
//   origin: 'http://example.com',
//   optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
// }

var app = express()

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
  })
) // Allows incoming requests from any I

app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

var pathFolder
var urls = []

// Start by creating some disk storage options:
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    const { project, folder, password } = req.body
    // console.log('project', project)
    // console.log('folder', folder)
    // console.log('password', password)
    // console.log('process.env.PASSWORD', process.env.PASSWORD)
    // if (!!password && password === process.env.PASSWORD) {
    pathFolder = `${project}/${folder}`
    const serverPath = `${__dirname}/../client/temp`
    // const serverPath = `${__dirname}/../client/uploads/${pathFolder}`
    // console.log('req.headers', req.headers)
    // fs.mkdirSync(serverPath, { recursive: true })
    fs.mkdirSync(`${__dirname}/../client/uploads/${pathFolder}`, {
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
    const extension = file.mimetype.split('/')[1]
    const newFileName = `${randomPart}.${extension}`
    urls.push(`${pathFolder}/${newFileName}`)
    callback(null, newFileName)
  },
  // Sets saved filename(s) to be original filename(s)
})

// Set saved storage options:
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
      if (noFolders)
        res.json(
          files.filter((file) =>
            fs.statSync(`${directoryPath}/${file}`).isFile()
          )
        )
      else res.json(files)
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
  // sharp.cache(false)
  // console.log('req.file.destination', req.file.destination)
  await sharp(req.file.path)
    .resize(2400, 2400, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toFile(
      path.resolve(req.file.destination, '../uploads/', pathFolder, filename)
    )
  fs.unlinkSync(req.file.path)

  const urlsToSend = urls.map(
    (url) => `https://escalioncloud.ru/uploads/${url}`
  )
  urls = []
  console.log('urlsToSend', urlsToSend)
  res.json(urlsToSend)
  // res.json(true)
})

app.listen(5000, function () {
  console.log('Server running on port 5000')
})
