const Token = (sequelize, DataTypes) => {
  const Token = sequelize.define(
    "Token",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      device_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      device_type: {
        type: DataTypes.ENUM("Android", "ios"),
        allowNull: false,
        validate: { isIn: [["Android", "ios"]] },
      },
      device_token: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tokenVersion: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false, 
      },
    },
    {
      timestamps: true,
      tableName: "tbl_token",
      paranoid: true,
    }
  );

  Token.associate = (models) => {
    Token.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };
  return Token
};

module.exports = Token;
