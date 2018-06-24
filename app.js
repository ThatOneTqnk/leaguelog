const express = require('express')
const app = express()
const botz = require('./bot.js')
const morgan = require('morgan');

app.use(express.static('public'));
app.use(morgan('dev'));

const listener = app.listen(4200, () => {
  console.log(`Your app is listening on port 4200`);
});