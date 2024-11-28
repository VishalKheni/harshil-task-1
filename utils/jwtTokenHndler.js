const jwt = require("jsonwebtoken");
require("dotenv").config();


const generateToken = (data) => {
  return jwt.sign(data, process.env.accessskey, { expiresIn: "1w" });
};

module.exports = generateToken;
