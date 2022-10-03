const express = require('express')
const app = express()
const port = 3000

app.get('/', (req, res) => {
  res.setHeader('content-type', 'text/plain')
  res.setHeader('X-Arch', `${process.arch}`)
  res.send(`This processor architecture is ${process.arch}`)
})

app.listen(port, () => {
  console.log(`server running on processor architecture ${process.arch}, port number ${port}`)
})