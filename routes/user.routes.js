const router = require("express").Router();

const user = require("../controllers/user.controller");
const verifyToken = require("../middleware/auth.middleware");
const upload = require("../middleware/multer.middleware");

router.post("/register", user.signUpUser);
router.post("/login", user.loginUser);
router.post("/logout", verifyToken, user.logoutUser);
  

// verify otp for signup and login
router.post("/verifyotp", user.verifyOtp);

// resend otp for signup and login
router.post("/resendotp", user.resendOTP);

// send otp for forgot password
router.post("/forgotpassword", user.requestPasswordReset);

// verify otp for forgot password
router.post("/verifyotpforforgotpassword", user.verifyOtpForPasswordReset);

// reset password after verify otp
router.patch("/resetpassword", user.resetUserPassword);

// resend otp for forgot password
router.post("/resendotpforpassword", user.resendOtpForPasswordReset); 

// change current passsword
router.put("/change-password", verifyToken, user.changeUserPassword);

// upload profile image
const uploadImage = upload.single("profile");
router.post("/profile_image", verifyToken, uploadImage, user.uploadProfileImage);
router.put("/edit_profile", verifyToken, uploadImage, user.updateProfile);

// user profile
router.get("/profile", verifyToken, user.getUserProfile);

// delete account
router.delete("/delete_account", verifyToken, user.deleteUserAccount);

module.exports = router;
