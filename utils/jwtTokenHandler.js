const jwt = require("jsonwebtoken");
require("dotenv").config();


const generateToken = (data) => {
  return jwt.sign(data, process.env.accessKey, { expiresIn: "1w" });
};

module.exports = generateToken;
