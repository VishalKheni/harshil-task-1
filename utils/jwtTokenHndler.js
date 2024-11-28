const jwt = require('jsonwebtoken');
accessskey='@£$%^&*'

function generateToken(data) {
    return jwt.sign(data, accessskey, { expiresIn: "1w" })
}


module.exports =  generateToken;