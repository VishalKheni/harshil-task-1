const bcrypt = require("bcrypt");

const User = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      profile: {
        type: DataTypes.STRING,
      },

      otp: {
        type: DataTypes.STRING,
      },
    },
    {
      timestamps: true,
      tableName: "tbl_user",
      hooks: {
        beforeCreate: async (user) => {
          if (user.password) {
            const hashPassword = await bcrypt.hash(
              user.password,
              await bcrypt.genSalt(10)
            );
            user.password = hashPassword;
          }
        },
        afterCreate: (row) => {
          delete row.dataValues.password;
        },
      },
    }
  );

  User.associate = (models) => {
    User.hasMany(models.Token, {
      foreignKey: "userId",
      as: "tokens",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };
  return User
};

module.exports = User;
