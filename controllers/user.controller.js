const DB = require("../models/index");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/jwtTokenHandler");
const { sendOTPByEmail, generateOTP } = require("../helper/helper");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");

// sign up new account
const signUpUser = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    device_id,
    device_type,
    device_token,
  } = req.body;

  const transaction = await DB.sequelize.transaction();

  try {
    const emailExists = await DB.User.findOne({
      where: { email },
      transaction,
    });

    if (emailExists) {
      return res
        .status(403)
        .json({ success: false, message: "Email already exists" });
    }

    const otp = generateOTP();
    const user = await DB.User.create(
      {
        firstName,
        lastName,
        email,
        otp,
        otp_created_at: new Date(),
        otp_type: "signup",
        otp_verified: true,
        is_account_setup: true,
        password,
      },
      { transaction }
    );

    const fullname = `${user.firstName} ${user.lastName}`;
    await sendOTPByEmail(user.email, otp, fullname);

    const tokenRecord = await DB.Token.create(
      {
        device_id,
        device_type,
        device_token,
        tokenVersion: 1,
        userId: user.id,
      },
      { transaction }
    );

    const token = generateToken({
      userId: user.id,
      tokenId: tokenRecord.id,
      tokenVersion: tokenRecord.tokenVersion,
    });

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "The OTP has been sent to your registered email.",
      user: {
        email: user.email,
        otp: user.otp,
      },
      token,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error signing up user:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// login user with email and password
const loginUser = async (req, res) => {
  const { email, password, device_id, device_type, device_token } = req.body;

  try {
    const user = await DB.User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email.",
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Please try again.",
      });
    }

    const otp = generateOTP();
    const fullname = `${user.firstName} ${user.lastName}`;
    await sendOTPByEmail(user.email, otp, fullname);

    await user.update({
      otp: otp,
      otp_created_at: new Date(),
      otp_type: "login",
      otp_verified: true,
      is_account_setup: true,
    });
    await user.save();

    let tokenRecord = await DB.Token.findOne({
      where: { device_id, userId: user.id },
    });

    if (tokenRecord) {
      tokenRecord.device_token = device_token;
      tokenRecord.device_type = device_type;
      const currentVersion = tokenRecord.tokenVersion;
      const randomIncrement = Math.floor(1 + Math.random() * 9);
      tokenRecord.tokenVersion = currentVersion + randomIncrement;
      await tokenRecord.save();
    } else {
      tokenRecord = await DB.Token.create({
        device_id,
        device_type,
        device_token,
        tokenVersion: Math.floor(1 + Math.random() * 9),
        userId: user.id,
      });
    }

    const token = generateToken({
      userId: user.id,
      tokenId: tokenRecord.id,
      tokenVersion: tokenRecord.tokenVersion,
    });

    return res.status(200).json({
      success: true,
      message: "The OTP has been sent to your registered email.",
      otp,
      token,
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const logoutUser = async (req, res) => {
  try {
    await req.token.destroy();

    return res.status(200).json({
      success: true,
      message: "Successfully logged out from this device.",
    });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error.",
    });
  }
};

// verify otp with email and otp
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await DB.User.findOne({ where: { email } });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.otp != otp) {
      return res.status(400).json({
        success: false,
        message: "OTP Invalid. Please enter valid OTP",
      });
    }
    if (user.otp_type !== "signup" && user.otp_type !== "login") {
      return res.status(400).json({
        success: false,
        message: "OTP Type Invalid.",
      });
    }

    const otpExpirationTime = 2 * 60 * 1000; // OTP valid for 2 minutes
    const isOtpValid =
      new Date() - new Date(user.otp_created_at) <= otpExpirationTime;

    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Update user to mark OTP as verified
    await user.update({
      otp: null,
      otp_created_at: null,
      otp_type: null,
      otp_verified: false,
    });

    return res
      .status(200)
      .json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// resend otp with email
const resendOTP = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await DB.User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this email does not exist",
      });
    }

    if (user.otp_type !== "signup" && user.otp_type !== "login") {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP type. Please request a new OTP",
      });
    }

    // Check if the user has recently requested an OTP
    const otpRequestLimit = 1 * 60 * 1000; // valid 1 minitue
    const timeSinceLastOtp = new Date() - new Date(user.otp_created_at || 0);

    if (timeSinceLastOtp < otpRequestLimit) {
      return res.status(429).json({
        success: false,
        message: "You can request a new OTP only after 1 minute.",
      });
    }

    const newOTP = generateOTP();
    await user.update({
      otp: newOTP,
      otp_created_at: new Date(),
      otp_type: user.otp_type,
      otp_verified: false,
    });

    const fullname = `${user.firstName} ${user.lastName}`;
    await sendOTPByEmail(user.email, newOTP, fullname);

    return res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your registered email.",
      newOTP,
    });
  } catch (error) {
    console.error("Error in resending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while resending the OTP.",
    });
  }
};

// send forgot password otp in email
const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await DB.User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this email does not exist",
      });
    }

    const OTP = generateOTP();
    await user.update({
      otp: OTP,
      otp_created_at: new Date(),
      otp_type: "forgot_password",
      otp_verified: false,
    });

    const fullname = `${user.firstName} ${user.lastName}`;
    await sendOTPByEmail(user.email, OTP, fullname);

    return res.status(200).json({
      success: true,
      message: "OTP sent to your registered email.",
      OTP,
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing your request.",
    });
  }
};

const verifyOtpForPasswordReset = async (req, res) => {
  const { email, otp } = req.body;

  try {
    // const user = await DB.User.findOne({ where: { email } });

    // if (!user) {
    //   return res
    //     .status(404)
    //     .json({ success: false, message: "User not found" });
    // }

    // if (user.otp != otp || user.otp_type !== "forgot_password") {
    //   return res.status(400).json({
    //     success: false,
    //     message: "OTP Invalid. Please enter valid OTP",
    //   });
    // }

    const user = await DB.User.findOne({
      where: {
        email,
        otp_type: "forgot_password",
      },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "OTP Invalid. Please enter valid OTP",
      });
    }

    const otpExpirationTime = 2 * 60 * 1000; // OTP valid for 2 minutes
    const isOtpValid =
      new Date() - new Date(user.otp_created_at) <= otpExpirationTime;

    if (!isOtpValid) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Update user to mark OTP as verified
    await user.update({
      otp: null,
      otp_created_at: null,
      otp_type: null,
      otp_verified: true,
    });

    return res
      .status(200)
      .json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// reset password after verify otp
const resetUserPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    const user = await DB.User.findOne({ where: { email } });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.otp_verified) {
      return res.status(400).json({
        success: false,
        message: "You cannot reset the password without OTP verification.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({
      password: hashedPassword,
      otp: null,
      otp_created_at: null,
      otp_type: null,
      otp_verified: false,
    });

    await DB.Token.destroy({ where: { userId: user.id } });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully.",
    });
  } catch (error) {
    console.error("Error in resetting password:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while resetting the password.",
    });
  }
};

const resendOtpForPasswordReset = async (req, res) => {
  const { email } = req.body;

  try {
    // const user = await DB.User.findOne({ where: { email } });
    const user = await DB.User.findOne({
      where: {
        email,
        otp_type: "forgot_password",
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this email does not exist.",
      });
    }

    // if (user.otp_type !== "forgot_password") {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid OTP type.",
    //   });
    // }

    // Check if the user has recently requested an OTP
    const otpRequestLimit = 1 * 60 * 1000; // valid 1 minitue
    const timeSinceLastOtp = new Date() - new Date(user.otp_created_at || 0);

    if (timeSinceLastOtp < otpRequestLimit) {
      return res.status(429).json({
        success: false,
        message: "You can request a new OTP only after 1 minute.",
      });
    }

    const newOTP = generateOTP();
    await user.update({
      otp: newOTP,
      otp_created_at: new Date(),
      otp_type: user.otp_type,
      otp_verified: false,
    });

    const fullname = `${user.firstName} ${user.lastName}`;
    const sendOTP = await sendOTPByEmail(user.email, newOTP, fullname);
    if (!sendOTP) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "A new OTP has been sent to your registered email.",
      newOTP,
    });
  } catch (error) {
    console.error("Error in resending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while resending the OTP.",
    });
  }
};

// change current password
const changeUserPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    // same password not allow
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      req.user.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current Password not valid",
      });
    }

    // Update the password in the database
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await req.user.update({ password: hashedNewPassword });

    await req.token.destroy({
      where: {
        userId: req.token.userId,
        id: { [Op.ne]: req.token.id },
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Password changed Successfully. Other sessions have been logged out.",
    });
  } catch (error) {
    console.error("Error in changed password:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// upload profile image
const uploadProfileImage = async (req, res) => {
  try {
    //set this validation on validation file
    const file = req.file?.filename;

    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    await req.user.update({ profile: file });
    const { password, ...userData } = req.user.dataValues;

    return res.status(200).json({
      success: true,
      message: "Profile Image upload successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Profile Image upload Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// update Profile  detail
const updateProfile = async (req, res) => {
  const { firstName, lastName, email } = req.body;

  try {
    if (email === req.user.email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is already in use" });
    }

    // Update the user profile fields
    const updatedUser = {
      firstName: firstName || req.user.firstName,
      lastName: lastName || req.user.lastName,
      email: email || req.user.email,
    };

    if (req.file) {
      // Delete the old image if it exists
      if (req.user.profile) {
        const oldImagePath = path.join(
          __dirname,
          "..",
          "public",
          req.user.profile.trim()
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        } else {
          console.log(`Old image not found: ${oldImagePath}`);
        }
      }
      updatedUser.profile = req.file?.filename;
    }

    await req.user.update(updatedUser);
    const { password, ...userData } = req.user.dataValues;

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: userData,
    });
  } catch (error) {
    console.error("Profile update Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// retrive profile detail
const getUserProfile = async (req, res) => {
  const { password, ...userData } = req.user.dataValues;
  return res
    .status(200)
    .json({ message: "Data retrieved successfully", userData });
};

// delete account
const deleteUserAccount = async (req, res) => {
  try {
    await req.user.destroy();
    return res
      .status(200)
      .json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  signUpUser,
  verifyOtp,
  resendOTP,
  loginUser,
  logoutUser,
  requestPasswordReset,
  verifyOtpForPasswordReset,
  resetUserPassword,
  resendOtpForPasswordReset,
  changeUserPassword,
  uploadProfileImage,
  updateProfile,
  getUserProfile,
  deleteUserAccount,
};
