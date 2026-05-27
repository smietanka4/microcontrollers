const express = require('express');
const cors = require('cors');
const { SerialPort } = require('serialport')
const { ReadlineParser } = require('@serialport/parser-readline')


const app = express()

app.use(cors())
app.use(express.json())

const PORT = 3000

app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`)
})