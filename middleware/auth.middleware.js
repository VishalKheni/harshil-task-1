const jwt = require("jsonwebtoken");
const { User, Token } = require("../models/index");
require("dotenv").config();

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed - Token missing in header",
      });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed - Token not provided",
      });
    }

    const decodedToken = jwt.verify(token, process.env.accessKey);
    const { userId, tokenId, tokenVersion } = decodedToken;
    
    if (!userId || !tokenId || !tokenVersion) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid token payload" });
    }

    const user = await User.findByPk(userId);
    const tokens = await Token.findByPk(tokenId);

    if (!user || !tokens || tokens.tokenVersion !== tokenVersion) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.user = user;
    req.token = tokens;
    next();
  } catch (error) {
    console.error("Error verifying JWT:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = verifyToken;
