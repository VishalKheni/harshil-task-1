const DB = require("../models/index");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/jwtTokenHandler");
const { sendOTPByEmail, generateOTP } = require("../helper/helper");
const fs = require("fs");
const path = require("path");
const sequelize = require("sequelize");

// const signUp = async (req, res) => {
//   const {
//     firstName,
//     lastName,
//     email,
//     password,
//     device_id,
//     device_type,
//     device_token,
//   } = req.body;

//   try {
//     const emailExists = await DB.User.findOne({ where: { email } });
//     if (emailExists) {
//       return res
//         .status(403)
//         .json({ success: false, message: "Email already exists" });
//     }

//     const otp = generateOTP();
//     const user = await DB.User.create({
//       firstName,
//       lastName,
//       email,
//       otp,
//       otp_created_at: new Date(),
//       otp_type: "signup",
//       password,
//     });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         message: "An error occurred while registering the user",
//       });
//     }

//     const fullname = `${user.firstName} ${user.lastName}`;
//     const otpSent = await sendOTPByEmail(user.email, otp, fullname);

//     if (!otpSent) {
//       await DB.Token.destroy({ where: { userId: user.id } });
//       await DB.User.destroy({ where: { id: user.id } });
//       return res.status(500).json({
//         success: false,
//         message: "Failed to send OTP. Please try again.",
//       });
//     }

//     const tokenRecord = await DB.Token.create({
//       device_id,
//       device_type,
//       device_token,
//       tokenVersion: 1,
//       userId: user.id,
//     });

//     const token = generateToken({
//       userId: user.id,
//       tokenId: tokenRecord.id,
//       tokenVersion: tokenRecord.tokenVersion,
//     });

//     return res.status(201).json({
//       success: true,
//       message: "The OTP has been sent to your registered email.",
//       user: {
//         email: user.email,
//         otp: user.otp,
//       },
//       token,
//     });
//   } catch (error) {
//     console.error("Error signing up user:", error);
//     res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// };

// sign up new account

const signUp = async (req, res) => {
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
      await transaction.rollback();
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
        otp_verified: false,
        password,
      },
      { transaction }
    );

    if (!user) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "An error occurred while registering the user",
      });
    }

    const fullname = `${user.firstName} ${user.lastName}`;
    const otpSent = await sendOTPByEmail(user.email, otp, fullname);

    if (!otpSent) {
      await DB.User.destroy({ where: { id: user.id }, transaction });
      await DB.Token.destroy({ where: { userId: user.id }, transaction });
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

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
    console.error("Error signing up user:", error);
    await transaction.rollback();
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// login user with email and password
const login = async (req, res) => {
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
    const otpSent = await sendOTPByEmail(email, otp, fullname);

    if (!otpSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    user.otp = otp;
    user.otp_created_at = new Date();
    user.otp_type = "login";
    user.otp_verified = false;
    await user.save();

    let tokenRecord = await DB.Token.findOne({
      where: { device_id, userId: user.id },
      paranoid: false,
    });

    if (tokenRecord) {
      if (tokenRecord.deletedAt) {
        await tokenRecord.restore();
      }
      tokenRecord.device_token = device_token;
      tokenRecord.device_type = device_type;
      tokenRecord.is_deleted = false;
      const currentVersion = tokenRecord.tokenVersion || 0;
      const randomIncrement = Math.floor(1 + Math.random() * 9);
      tokenRecord.tokenVersion = currentVersion + randomIncrement;
      await tokenRecord.save();
    } else {
      tokenRecord = await DB.Token.create({
        device_id,
        device_type,
        device_token,
        tokenVersion: Math.floor(1 + Math.random() * 9),
        is_deleted: false,
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

const logout = async (req, res) => {
  try {
    const token = await DB.Token.findOne({
      where: {
        userId: req.user.id,
        id: req.token.id,
        tokenVersion: req.token.tokenVersion,
      },
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        message: "No active session found for this device.",
      });
    }

    token.is_deleted = true;
    await token.destroy();

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

    if (
      user.otp != otp ||
      (user.otp_type !== "signup" && user.otp_type !== "login")
    ) {
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
      return res.status(400).json({
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
    if (!newOTP) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    await user.update({
      otp: newOTP,
      otp_created_at: new Date(),
      otp_type: user.otp_type,
      otp_verified: false,
    });

    const fullname = `${user.firstName} ${user.lastName}`;
    await sendOTPByEmail(email, newOTP, fullname);

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
const forgotPassword = async (req, res) => {
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
    const sendOtp = await sendOTPByEmail(email, OTP, fullname);
    if (!sendOtp) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

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

const verifyOtpForForgotPassword = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await DB.User.findOne({ where: { email } });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.otp != otp || user.otp_type !== "forgot_password") {
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
const resetPassword = async (req, res) => {
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

    await DB.Token.findOne({ where: { userId: user.id } });
    // await DB.Token.destroy({
    //   where: {
    //     userId: token.userId,
    //     id: token.id,
    //     tokenVersion: token.tokenVersion,
    //   },
    // });
    // token.is_deleted = true;

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

const resendOTPForPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await DB.User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this email does not exist",
      });
    }

    if (user.otp_type !== "forgot_password") {
      return res.status(400).json({
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
    if (!newOTP) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    await user.update({
      otp: newOTP,
      otp_created_at: new Date(),
      otp_type: user.otp_type,
      otp_verified: false,
    });

    const fullname = `${user.firstName} ${user.lastName}`;
    await sendOTPByEmail(email, newOTP, fullname);

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
const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  try {
    // same password not allow
    const isSamePassword = await bcrypt.compare(oldPassword, req.user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as the old password",
      });
    }

    // Update the password in the database
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await req.user.update({ password: hashedNewPassword });

    const token = await DB.Token.findOne({
      where: {
        userId: req.user.id,
        id: req.token.id,
        tokenVersion: req.token.tokenVersion,
      },
    });

    if (token) {
      // delete other deveice
      await DB.Token.destroy({
        where: {
          userId: req.user.id,
          id: { [sequelize.Op.ne]: token.id },
        },
      });
      token.is_deleted = false;
    } else {
      return res.status(400).json({
        success: false,
        message: "Token not found for the current session",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Password changed successfully. Other sessions have been logged out.",
    });
  } catch (error) {
    console.error("Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// upload profile image
const addProfileImage = async (req, res) => {
  const { userId } = req.user;

  try {
    //set this validation on validation file
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    await req.user.update({ profile: req.file.filename });

    return res.status(200).json({
      success: true,
      message: "Profile Image upload successfully",
      user: req.user,
    });
  } catch (error) {
    console.error("Profile Image upload Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// edit prodile detail
const editProfile = async (req, res) => {
  const { firstName, lastName, email } = req.body;

  if (email === req.user.email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is already in use" });
  }

  try {
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
      updatedUser.profile = req.file.filename;
    }

    await req.user.update(updatedUser);

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: req.user,
    });
  } catch (error) {
    console.error("Profile update Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// retrive profile detail including deveice detail
const getProfile = async (req, res) => {
  const getdata = await DB.User.findByPk(req.user.id, {
    attributes: { exclude: ["password"] },
    include: [
      {
        model: DB.Token,
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

// delete account
const deleteAccount = async (req, res) => {
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
  signUp,
  verifyOtp,
  resendOTP,
  login,
  logout,
  forgotPassword,
  verifyOtpForForgotPassword,
  resetPassword,
  resendOTPForPassword,
  changePassword,
  addProfileImage,
  editProfile,
  getProfile,
  deleteAccount,
};
