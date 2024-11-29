const Sequelize = require("sequelize");
const DB = require("../config/db.connect");

const sequelize = new Sequelize(DB.DBName, DB.DBUsername, DB.DBPassword, {
  host: DB.DBhost,
  dialect: DB.DBdialect,
});
const db = {};

const User = require("./User.model");
const Token = require("./Token.model");

db.User = User(sequelize, Sequelize);
db.Token = Token(sequelize, Sequelize);

Object.values(db).forEach((model) => {
  if (model.associate) {
    model.associate(db);
  }
});

db.Sequelize = Sequelize;
db.sequelize = sequelize;

module.exports = db;
