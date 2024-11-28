const jwt = require("jsonwebtoken");
accessskey = "@£$%^&*";

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res
        .status(401)
        .json({ message: "Authentication failed - Token missing on header" });
    }

    const token = req.headers["authorization"].split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Authentication failed " });
    }

    const decodedToken = jwt.verify(token, accessskey);
    // const user = await db.User.findByPk(decodedToken.userId);
    // const tokens = await db.Token.findByPk(decodedToken.tokenId);
    // if (!user || !tokens || (tokens.tokenVersion !== decodedToken.tokenVersion)) {
    //   return res.status(401).json({ error: 'Invalid token' });
    // }

    if (!decodedToken) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying JWT:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
};

module.exports = verifyToken;
