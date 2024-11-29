const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendOTPByEmail = async (email, otp, fullname) => {
  const mailOptions = {
    from: process.env.SMTP_MAIL,
    to: email,
    subject: "OTP Verification",
    // text: `Your OTP for email verification is: ${otp}`,
    html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #4CAF50; font-size: 24px;">Your OTP Verification Code</h2>
        <p style="font-size: 16px;">Dear <strong>${fullname}</strong>,</p>
        <p style="font-size: 16px;">Please use the following OTP to verify your email address:</p>
        <div style="margin: 20px 0; font-size: 24px; font-weight: bold; color: #4CAF50; text-align: center;">
          <span style="padding: 10px 20px; border: 2px solid #4CAF50; border-radius: 4px;">${otp}</span>
        </div>
        <p style="font-size: 16px;">If you did not request this, please ignore this email.</p>
        <br />
        <p style="font-size: 16px;">Best regards,</p>
        <p style="font-size: 16px;"><strong>Your Company Name</strong></p>
      </div>
    </div>
  `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
    return info.response;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

const generateOTP = (length = 4) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return `${Math.floor(Math.random() * (max - min + 1)) + min}`;
};

module.exports = { sendOTPByEmail, generateOTP };
