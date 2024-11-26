const router = require("express").Router();

const { register, login, addtoken, getData } = require("../controllers/user.controller");
const verifyToken = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);

router.post("/token", verifyToken, addtoken);
router.get("/get", verifyToken, getData);

module.exports = router;    
