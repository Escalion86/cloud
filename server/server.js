const express = require('express')
const multer = require('multer')
const cors = require('cors')
const fs = require('fs')
require('dotenv').config()
// console.log(process.env) // remove this after you've confirmed it is working

var app = express()
app.use(cors()) // Allows incoming requests from any I
var urls = []
var path

// Start by creating some disk storage options:
const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    const { project, folder, password } = req.body
    console.log('project', project)
    console.log('folder', folder)
    console.log('password', password)
    console.log('process.env.PASSWORD', process.env.PASSWORD)
    if (!!password && password === process.env.PASSWORD) {
      path = `${project}/${folder}`
      const serverPath = `${__dirname}/../client/uploads/${path}`
      // console.log('req.headers', req.headers)
      fs.mkdirSync(serverPath, { recursive: true })
      callback(null, serverPath)
    } else {
      callback('Wrong password')
    }
  },
  // Sets file(s) to be saved in uploads folder in same directory
  filename: function (req, file, callback) {
    urls.push(`${path}/${file.originalname}`)
    callback(null, file.originalname)
  },
  // Sets saved filename(s) to be original filename(s)
})

// Set saved storage options:
const upload = multer({ storage })

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
  console.log('req.body', req.body)
  const protocol = req.protocol
  const host = req.hostname
  // const url = req.originalUrl
  // const port = process.env.PORT || PORT

  const domain = `${protocol}://${host}`
  // Sets multer to intercept files named "files" on uploaded form data
  // console.log('req.headers2', req.headers)
  // console.log(req.body) // Logs form body values
  // console.log(req.files) // Logs any files
  res.json(urls.map((url) => `${domain}:82/uploads/${url}`))
  // res.json(true)
})

app.listen(5000, function () {
  console.log('Server running on port 5000')
})
