const express = require('express')
const multer = require('multer')
const cors = require('cors')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
require('dotenv').config()
// console.log(process.env) // remove this after you've confirmed it is working
// var corsOptions = {
//   origin: 'http://example.com',
//   optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
// }

var app = express()
app.use(
  cors({
    allowedHeaders: [
      // 'authorization',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Origin',
      // 'Access-Control-Request-Method',
      // 'Access-Control-Request-Headers',
      // 'Origin',
      // 'Cache-Control',
      // 'Content-Type',
      // 'X-Token',
      // 'X-Refresh-Token',
    ], // you can change the headers
    // exposedHeaders: ['authorization'], // you can change the headers
    origin: [
      'http://www.xn--80aaennmesfbiiz1a7a.xn--p1ai',
      'http://xn--80aaennmesfbiiz1a7a.xn--p1ai',
      'https://www.xn--80aaennmesfbiiz1a7a.xn--p1ai',
      'https://xn--80aaennmesfbiiz1a7a.xn--p1ai',
      'escalioncloud.ru',
      'www.escalioncloud.ru',
      'http://localhost:3000',
    ],
    // methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    // preflightContinue: false,
  })
) // Allows incoming requests from any I

var path
var urls = []

// Start by creating some disk storage options:
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    const { project, folder, password } = req.body
    console.log('project', project)
    console.log('folder', folder)
    // console.log('password', password)
    // console.log('process.env.PASSWORD', process.env.PASSWORD)
    // if (!!password && password === process.env.PASSWORD) {
    path = `${project}/${folder}`
    const serverPath = `${__dirname}/../client/uploads/${path}`
    // console.log('req.headers', req.headers)
    fs.mkdirSync(serverPath, { recursive: true })
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
    urls.push(`${path}/${newFileName}`)
    callback(null, newFileName)
  },
  // Sets saved filename(s) to be original filename(s)
})

// Set saved storage options:
var maxSize = 100 * 1024 * 1024 * 1024
const upload = multer({ storage, limits: { fileSize: maxSize } })

// app.get('*', function (req, res) {
//   const protocol = req.protocol
//   const host = req.hostname
//   const url = req.originalUrl
//   const port = process.env.PORT || PORT

//   const fullUrl = `${protocol}://${host}:${port}${url}`

//   const responseString = `Full URL is: ${fullUrl}`
//   res.send(responseString)
// })

app.post('/api', upload.array('files'), (req, res) => {
  // console.log('req.body', req.body)
  // const protocol = req.protocol
  // const host = req.hostname
  // const url = req.originalUrl
  // const port = process.env.PORT || PORT

  // const domain = `${protocol}://${host}`
  // Sets multer to intercept files named "files" on uploaded form data
  // console.log('req.headers2', req.headers)
  // console.log(req.body) // Logs form body values
  // console.log(req.files) // Logs any files
  const urlsToSend = urls.map(
    (url) => `https://escalioncloud.ru/uploads/${url}`
  )
  urls = []
  res.json(urlsToSend)
  // res.json(true)
})

app.listen(5000, function () {
  console.log('Server running on port 5000')
})
