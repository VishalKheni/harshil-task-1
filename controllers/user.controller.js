const { User, Token } = require("../models/index");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/jwtTokenHandler");
const { sendOTPByEmail, generateOTP } = require("../helper/helper");
const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");

const register = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    password,
    device_id,
    device_type,
    device_token,
  } = req.body;

  try {
    const emailExists = await User.findOne({ where: { email } });
    if (emailExists) {
      return res
        .status(403)
        .json({ success: false, message: "Email already exists" });
    }

    const otp = generateOTP();
    const user = await User.create({
      firstName,
      lastName,
      email,
      otp,
      otp_created_at: new Date(),
      password,
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "An error occurred while registering the user",
      });
    }

    const fullname = user.firstName + " " + user.lastName;
    const otpSent = await sendOTPByEmail(user.email, otp, fullname);

    if (!otpSent) {
      await Token.destroy({ where: { userId: user.id } });
      await User.destroy({ where: { id: user.id } });
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    const tokenRecord = await Token.create({
      device_id,
      device_type,
      device_token,
      tokenVersion: 1,
      userId: user.id,
    });

    const token = generateToken({
      userId: user.id,
      tokenId: tokenRecord.id,
      tokenVersion: tokenRecord.tokenVersion,
    });

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
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// login user with email and password
const login = async (req, res) => {
  const { email, password, device_id, device_type, device_token } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

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
    const fullname = user.firstName + " " + user.lastName;
    const otpSent = await sendOTPByEmail(email, otp, fullname);

    if (!otpSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    user.otp = otp;
    user.otp_created_at = new Date();
    await user.save();

    let tokenRecord = await Token.findOne({
      where: { device_id, userId: user.id },
    });

    if (tokenRecord) {
      tokenRecord.device_token = device_token;
      tokenRecord.device_type = device_type;
      const currentVersion = tokenRecord.tokenVersion || 0;
      const randomIncrement = Math.floor(1 + Math.random() * 9);
      tokenRecord.tokenVersion = currentVersion + randomIncrement;
      await tokenRecord.save();
    } else {
      tokenRecord = await Token.create({
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

const logout = async (req, res) => {
  const { device_id } = req.body;
  const { userId } = req.user;

  if (!device_id) {
    return res.status(400).json({
      success: false,
      message: "Device ID is required for logout.",
    });
  }

  try {
    const token = await Token.findOne({
      where: { device_id, userId },
    });

    if (!token) {
      return res.status(404).json({
        success: false,
        message: "No active session found for this device.",
      });
    }

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
    const user = await User.findOne({ where: { email } });

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
    await User.update(
      { is_verify: true, otp: null, otp_created_at: null },
      { where: { id: user.id } }
    );

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
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this email does not exist",
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

    await User.update(
      { otp: newOTP, otp_created_at: new Date() },
      { where: { id: user.id } }
    );

    const fullname = user.firstName + " " + user.lastName;
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
    const user = await User.findOne({ where: { email } });
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
    });

    const fullname = user.firstName + " " + user.lastName;
    const sendOtp = await sendOTPByEmail(email, OTP, fullname);
    if (!sendOtp) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Reset OTP sent to your registered email.",
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing your request.",
    });
  }
};

// reset password after verify otp
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

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

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({
      password: hashedPassword,
      otp: null,
      otp_created_at: null,
    });

    await Token.destroy({ where: { userId: user.id } });

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

// change current password
const changePassword = async (req, res) => {
  const { oldPassword, newPassword, device_id } = req.body;
  const { userId } = req.user;

  try {
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    await User.update(
      { password: hashedNewPassword },
      { where: { id: user.id } }
    );

    // delete other deveice
    await Token.destroy({
      where: {
        userId,
        device_id: { [Op.ne]: device_id },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
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
    const user = await User.findOne({
      where: { id: userId },
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    const file = req.file.filename;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    await User.update({ profile: file }, { where: { id: user.id } });

    const updatedUser = await User.findOne({
      where: { id: user.id },
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({
      success: true,
      message: "Profile Image upload successfully",
      user: updatedUser,
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
  const { userId } = req.user;
  const { firstName, lastName, email } = req.body;

  try {
    const user = await User.findOne({
      where: { id: userId },
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    if (email === user.email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is already in use" });
    }

    // Update the user profile fields
    const updatedUserData = {
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email || user.email,
    };

    if (req.file) {
      if (user.profile) {
        const oldImagePath = path.join(
          __dirname,
          "..",
          "public",
          user.profile.trim()
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        } else {
          console.log(`Old image not found: ${oldImagePath}`);
        }
      }
      updatedUserData.profile = req.file.filename;
    }

    await User.update(updatedUserData, {
      where: { id: user.id },
    });

    const updatedUser = await User.findOne({
      where: { id: user.id },
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
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
  const { userId } = req.user;

  const getdata = await User.findOne({
    where: { id: userId },
    attributes: { exclude: ["password"] },
    include: [
      {
        model: Token,
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

// delete account detail
const deleteAccount = async (req, res) => {
  const { userId } = req.user;

  try {
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    await user.destroy();
    return res
      .status(200)
      .json({ success: true, message: "Accont deleted successfully" });
  } catch (error) {
    console.error("Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  register,
  verifyOtp,
  resendOTP,
  login,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  addProfileImage,
  editProfile,
  getProfile,
  deleteAccount,
};
