const jwt = require("jsonwebtoken");
require("dotenv").config();


const generateToken = (data) => {
  return jwt.sign(data, process.env.accessskey);
};

module.exports = generateToken;
