const Sequelize = require("sequelize");

const sequelize = new Sequelize("task", "root", "", {
  host: "localhost",
  dialect: "mysql",
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
