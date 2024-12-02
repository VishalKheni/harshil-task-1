const router = require("express").Router();

const user = require("../controllers/user.controller");
const verifyToken = require("../middleware/auth.middleware");
const upload = require("../middleware/multer.middleware");

router.post("/register", user.signUp);
router.post("/login", user.login);
router.post("/logout", verifyToken, user.logout);

// verify otp for signup and login
router.post("/verifyotp", user.verifyOtp);
router.post("/resendotp", user.resendOTP);

// verify otp for forgot password
router.post("/verifyotpforforgotpassword", user.verifyOtpForForgotPassword);
router.post("/resendotpforpassword", user.resendOTPForPassword);

router.post("/forgotpassword", user.forgotPassword);
router.patch("/resetpassword", user.resetPassword);

// change current passsword
router.put("/change-password", verifyToken, user.changePassword);

// upload profile image
const uploadImage = upload.single("profile");
router.post("/profile_image", verifyToken, uploadImage, user.addProfileImage);
router.put("/edit_profile", verifyToken, uploadImage, user.editProfile);

// user profile
router.get("/profile", verifyToken, user.getProfile);

// delete account
router.delete("/delete_account", verifyToken, user.deleteAccount);

module.exports = router;
