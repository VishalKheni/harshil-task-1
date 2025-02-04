require("dotenv").config();
const nodemailer = require("nodemailer")
let smtpUser = process.env.SMTPUSER;
let smtpPass = process.env.SMTPPASS;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

//send otp to email address
const sendOTPByEmail = async (email, otp) => {
  const mailOptions = {
    from: smtpUser,
    to: email,
    subject: "Verification Code: Complete Your Sign Up",
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
      <h2 style="color: #4CAF50; font-size: 24px;">Your OTP Verification Code</h2>
      <p style="font-size: 16px;">Dear User</p>
      <p style="font-size: 16px;">Please use the following OTP to verify your email address:</p>
      <div style="margin: 20px 0; font-size: 24px; font-weight: bold; color: #4CAF50; text-align: center;">
        <span style="padding: 10px 20px; border: 2px solid #4CAF50; border-radius: 4px;">${otp}</span>
      </div>
      <p style="font-size: 16px;">If you did not request this, please ignore this email.</p>
      <br />
      <p style="font-size: 16px;">Best regards,</p>
      <p style="font-size: 16px;"><strong>Your Company Name</strong></p>
    </div>
    </div>`,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    return info.response;
  } catch (error) {
    console.error("Error sending Sign Up email:", error);
    throw error;
  }
};

const sendContactUsEmail = async (email, message) => {
  const mailOptions = {
    from: email,
    to: smtpUser,
    subject: "New Contact Us Message Received",
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
      <h2 style="color: #4CAF50; font-size: 24px;">New Contact Message Received</h2>
      <p style="font-size: 16px;">Dear Admin,</p>
      <p style="font-size: 16px;">A user has submitted a message through the contact form. Here are the details:</p>
      <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
        <p style="margin: 0; font-size: 16px; margin-top: 10px;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0; font-size: 16px; margin-top: 10px;"><strong>Message:</strong></p>
        <p style="margin: 0; font-size: 16px; color: #555; margin-top: 10px;">${message}</p>
      </div>
      <p style="font-size: 16px;">Please review this inquiry and respond as necessary.</p>
      <br />
      <p style="font-size: 16px;">Best regards,</p>
      <p style="font-size: 16px;"><strong>Your Website System</strong></p>
    </div>
    </div>
    `,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    return info.response;
  } catch (error) {
    console.error("Error sending Contact Us email:", error);
    throw error;
  }
};


const sendEmailByadmin = async (email, password, firstname, lastname, user_role) => {
  const mailOptions = {
    from: smtpUser,
    to: email,
    subject: "New Account Created",
    html: ` 
    <html>
        <!-- Use the HTML template above, replace placeholders with actual user data -->
        <body>
            <div class="email-container">
                <h2>Account Created Successfully</h2>
                <p>Hello ${firstname} ${lastname},</p>
                <p>Your account has been successfully created. Below are your account details:</p>
                <ul>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Role:</strong> ${user_role}</li>
                </ul>
                <p><strong>Your temporary password is:</strong> <strong>${password}</strong></p>
                <p>Please use this password to log in to your account.</p>
                <div class="footer">
                    <p>Best regards,</p>
                    <p>The YourCompany Team</p>
                </div>
            </div>
        </body>
    </html>`
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    return info.response;
  } catch (error) {
    console.error("Error sending Contact Us email:", error);
    throw error;
  }
};


module.exports = { sendOTPByEmail, sendContactUsEmail, sendEmailByadmin };
