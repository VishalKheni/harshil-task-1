const router = require("express").Router();

const { register, login, addtoken } = require("../controllers/user.controller");
const verifyToken = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);

router.post("/token", verifyToken, addtoken);

module.exports = router;
