const router = require("express").Router();

const user = require("../controllers/user.controller");
const validator = require("../utils/validatonHandler");
const validaton = require("../validation/validation");
const upload = require("../middleware/multer.middleware");
const uploadImage = upload.single("profile");
const verifyToken = require("../middleware/auth.middleware");


// signup user
router.post("/signup", validator(validaton.signupValidation), user.signUpUser);

// login user
router.post("/login", validator(validaton.loginValidation), user.loginUser);

// logout user
router.post("/logout", verifyToken, user.logoutUser);

// verify otp for signup and login
router.post(
  "/verify_otp",
  validator(validaton.verifyOtpValidation),
  user.verifyOtp
);

// resend otp for signup and login
router.post(
  "/resend_otp",
  validator(validaton.sendOtpValidation),
  user.resendOTP
);

// send otp for forgot password
router.post(
  "/forgot_password",
  validator(validaton.sendOtpValidation),
  user.requestPasswordReset
);

// verify otp for forgot password
router.post(
  "/verifyotp_for_forgot_password",
  validator(validaton.verifyOtpValidation),
  user.verifyOtpForPasswordReset
);

// reset password after verify otp
router.patch(
  "/reset_password",
  validator(validaton.forgotPasswordValidation),
  user.resetUserPassword
);

// resend otp for forgot password
router.post(
  "/resendotp_for_forgot_password",
  validator(validaton.sendOtpValidation),
  user.resendOtpForPasswordReset
);
// change current passsword
router.put(
  "/change_password",
  verifyToken,
  validator(validaton.changePasswordValidation),
  user.changeUserPassword
);

// upload profile image
router.post("/upload_image", verifyToken, uploadImage, user.uploadProfileImage);

// update profile detail
router.put("/update_profile", verifyToken, uploadImage, user.updateProfile);
// user profile
router.get(
  "/get_profile",
  verifyToken,
  validator(validaton.updateProfileValidation),
  user.getUserProfile
);

// delete account
router.delete("/delete_account", verifyToken, user.deleteUserAccount);

module.exports = router;
