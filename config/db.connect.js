require("dotenv").config();

const DBConnect = {
    DBName : process.env.DBName,
    DBUsername : process.env.DBUsername,
    DBPassword : process.env.DBPassword,
    DBhost : process.env.DBhost,
    DBdialect : process.env.DBdialect
}

module.exports = DBConnect;