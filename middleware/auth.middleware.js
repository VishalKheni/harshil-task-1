const jwt = require("jsonwebtoken");
accessskey = "@£$%^&*";

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Authentication failed - Token missing on header",
        });
    }

    const token = req.headers["authorization"].split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed " });
    }

    const decodedToken = jwt.verify(token, accessskey);

    if (!decodedToken) {
      return res.status(401).send({ success: false, message: "Unauthorized" });
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying JWT:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = verifyToken;
