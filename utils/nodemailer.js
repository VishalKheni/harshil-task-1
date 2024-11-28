const nodemailer = require("nodemailer");
require('dotenv').config();


const transporter = nodemailer.createTransport({
  service: 'gmail', 
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
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
      <h2 style="color: #4CAF50;">Your OTP Verification Code</h2>
      <p>Dear ${fullname},</p>
      <p>Please use the following OTP to verify your email address:</p>
      <div style="margin: 20px 0; font-size: 20px; font-weight: bold; color: #4CAF50;">
       OTP: ${otp}
      </div>
      <p>If you did not request this, please ignore this email.</p>
      <br />
      <p>Best regards,</p>
      <p><strong>Your Company Name</strong></p>
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



module.exports = sendOTPByEmail;