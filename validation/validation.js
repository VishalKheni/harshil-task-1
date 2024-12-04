const Joi = require("joi");

const signupValidation = {
  body: Joi.object({
    firstName: Joi.string().min(3).max(50).required(),
    lastName: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(5).max(15).required(),
    device_id: Joi.string().required(),
    device_type: Joi.string().valid("Android", "ios").required(),
    device_token: Joi.string().required(),
  }),
};

const loginValidation = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(5).max(15).required(),
    device_id: Joi.string().required(),
    device_type: Joi.string().valid("Android", "ios").required(),
    device_token: Joi.string().required(),
  }),
};

const verifyOtpValidation = {
  body: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.number().integer().min(1000).max(9999).required().messages({
      "number.base": "OTP must be a number",
      "number.min": "OTP must be a 4-digit number",
      "number.max": "OTP must be a 4-digit number",
      "any.required": "OTP is required",
    }),
  }),
};

const sendOtpValidation = {
  body: Joi.object({
    email: Joi.string().email().required(),
  }),
};

const forgotPasswordValidation = {
  body: Joi.object({
    email: Joi.string().email().required(),
    newPassword: Joi.string().min(5).max(15).required(),
  }),
};

const changePasswordValidation = {
  body: Joi.object({
    currentPassword: Joi.string().min(5).max(15).required(),
    newPassword: Joi.string().min(5).max(15).required(),
  }),
};

const updateProfileValidation = {
  body: Joi.object({
    firstName: Joi.string().min(3).max(50).optional(),
    lastName: Joi.string().min(3).max(50).optional(),
    email: Joi.string().email().optional(),
    profile: Joi.string().optional(),
  }),
};

module.exports = {
  signupValidation,
  loginValidation,
  verifyOtpValidation,
  sendOtpValidation,
  forgotPasswordValidation,
  changePasswordValidation,
  updateProfileValidation,
};
