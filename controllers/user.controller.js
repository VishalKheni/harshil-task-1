const { User, Token } = require("../model/index");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/jwtTokenHndler");

const register = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  const emailExists = await User.findOne({ where: { email } });
  if (emailExists) {
    return res.status(403).json({ message: "Email already exists" });
  }

  const user = await User.create({ firstName, lastName, email, password });
  if (!user) {
    return res
      .status(400)
      .json({ message: "Some Error occured while register new user" });
  }

  const token = generateToken({ userId: user.id });

  return res
    .status(201)
    .json({ message: "Account create successfully", user, token });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  const isValidPassword = bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(400).json({ message: "Invalid crediantial" });
  }

  const token = generateToken({ userId: user.id });

  return res.status(201).json({ message: "Login successfully", user, token });
};

const addtoken = async (req, res) => {
  const { userId } = req.user;
  const { device_id, device_type, device_token } = req.body;

  try {
    const token = await Token.create({
      device_id,
      device_type,
      device_token,
      userId,
    });
    if (!token) {
      return res.status(400).json({ message: "Some Error occured" });
    }
    return res.status(201).json({ message: "token add successfully", token });
  } catch (error) {
    console.log("error", error);
    return res.status(404).json({ message: "Internal server error", error });
  }
};

const getData = async (req, res) => {
  const { userId } = req.user;

  const getdata = await User.findOne({
    where: { id: userId },
    attributes: { exclude: ["password"] },
    include: [
      {
        model: Token,
        as: "tokens",
      },
    ],
  });

  if (!getdata) {
    return res.status(403).json({ message: "data not found" });
  }

  return res
    .status(200)
    .json({ message: "Data retrieved successfully", data: getdata });
};

module.exports = {
  register,
  login,
  addtoken,
  getData,
};
