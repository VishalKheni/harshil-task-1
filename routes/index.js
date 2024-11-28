const express = require('express');
const app = express();

const userRoutes = require('./user.routes')

app.use('/user_router', userRoutes);

module.exports = app