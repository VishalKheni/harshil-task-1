const { check, validationResult } = require("express-validator");
const verifyToken = require('../middleware/auth.middleware');
const multer = require("multer");
const upload = multer({ dest: "uploads/profile_image" });
const fs = require("fs");

console.log('in side of auth validation');

const validation = (req, res, next) => {
    console.log("<<input>>req.query", req.query);
    console.log("<<input>>req.body", req.body);
    console.log("<<input>>req.file", req.file);
    console.log("<<input>>req.files", req.files);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Unlink or remove any uploaded files if validation fails
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }

        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                fileArray.forEach(file => {
                    fs.unlinkSync(file.path);
                });
            });
        }
        return res.status(400).json({
            Status: 0,
            message: errors.array()[0].msg,
            type: errors.array()[0].type,
            value: errors.array()[0].value,
            path: errors.array()[0].path,
            location: errors.array()[0].location,
            error: errors
        });
    }
    next();
}
const checkForUnexpectedFields = (allowedFields) => {
    return (req, res, next) => {
        // Check for unexpected fields in req.body
        const unexpectedBodyFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));

        // Check for unexpected fields in req.query
        const unexpectedQueryFields = Object.keys(req.query).filter(field => !allowedFields.includes(field));

        // Check for unexpected files in req.files
        const unexpectedFileFields = Object.keys(req.files || {}).filter(field => !allowedFields.includes(field));

        // If there are any unexpected file fields, unlink all files from the request
        if (unexpectedFileFields.length > 0) {
            Object.values(req.files).forEach(fileArray => {
                fileArray.forEach(file => {
                    fs.unlinkSync(file.path);  // Remove the file from the server
                });
            });
        }

        // Combine all unexpected fields
        const unexpectedFields = [...unexpectedBodyFields, ...unexpectedQueryFields, ...unexpectedFileFields];

        if (unexpectedFields.length > 0) {
            return res.status(400).json({ Status: 0, message: `Unexpected fields: ${unexpectedFields.join(', ')}` });
        }

        next();
    };
};

exports.signUp = () => {
    return [
        [
            check("email").not().isEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email format").trim().escape(),
            check("password").not().isEmpty().withMessage("Password is required")
                .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long").trim().escape(),
            check("user_role").not().isEmpty().withMessage("user_role is required").trim().escape()
                .isIn(["user", "super_admin", "independent_contractor", "referral_partner", "oprational_profile"])
                .withMessage("Invalid value for user_role. Allowed values are 'user' or 'super_admin' or 'independent_contractor' or 'referral_partner' or 'referral_partner' or 'oprational_profile'."),
        ],
        checkForUnexpectedFields(["email", "user_role", "password"]),
        validation
    ];
}
exports.verifyOtp = () => {
    return [
        [
            check("email").not().isEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email format"),
            check("otp").not().isEmpty().withMessage("Otp is required").trim(),
            check("device_id").not().isEmpty().withMessage("Device ID is required").trim(),
            check("device_type").not().isEmpty().withMessage("Device type is required").trim(),
            check("device_token").not().isEmpty().withMessage("Device token is required").trim(),
        ],
        checkForUnexpectedFields(["email", "otp", "device_id", "device_type", "device_token"]),
        validation
    ];
}
exports.signin = () => {
    return [
        [
            check("email").not().isEmpty().withMessage("Email is required").trim().escape(),
            check("password").not().isEmpty().withMessage("Password is required")
                .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long").trim().escape(),
            check("device_id").not().isEmpty().withMessage("Device ID is required").trim().escape(),
            check("device_type").not().isEmpty().withMessage("Device type is required").trim().escape(),
            check("device_token").not().isEmpty().withMessage("Device token is required").trim().escape(),
        ],
        checkForUnexpectedFields(["user_role", "device_token", "device_type", "device_id", "email", "password"]),
        validation
    ];
}

exports.forgetPassword = () => {
    return [
        [
            check("email").not().isEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email format"),
        ],
        checkForUnexpectedFields(["email"]),
        validation
    ];
}
exports.forgetPasswordVerification = () => {
    return [
        [
            check("email").not().isEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email format"),
            check("otp").not().isEmpty().withMessage("Otp is required").trim(),
        ],
        checkForUnexpectedFields(["email", "otp"]),
        validation
    ];
}
exports.resetPassword = () => {
    return [
        [
            check("email").not().isEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email format"),
            check("newPassword").not().isEmpty().withMessage("Password is required")
                .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long").trim().escape(),
        ],
        checkForUnexpectedFields(["email", "newPassword"]),
        validation
    ];
}

exports.changePassword = () => {
    return [
        rateLimit.signUp(),
        [
            check("currentPassword").not().isEmpty().withMessage("Current Password is required")
                .isLength({ min: 6 }).withMessage("Old Password must be at least 8 characters long").trim().escape(),
            check("newPassword").not().isEmpty().withMessage("New Password is required")
                .isLength({ min: 6 }).withMessage("New Password must be at least 8 characters long").trim().escape(),
        ],
        checkForUnexpectedFields(["oldPassword", "newPassword"]),
        validation, verifyToken
    ];
}


exports.account_setup = () => {
    return [
        upload.fields([
            { name: "profile_image" },
        ]),
        [
            check("profile_image").custom((value, { req }) => {
                if (!req.files || !req.files.profile_image) {
                    throw new Error("profile_image is required");
                }
                if (req.files.profile_image.length > 1) {
                    req.files.profile_image.forEach(element => {
                        fs.unlinkSync(element.path);
                    });
                    throw new Error('Maximum 1 images allowed');
                }
                return true;
            }),
            check('firstname').not().isEmpty().withMessage("First Name is required")
                .isLength({ min: 2, max: 50 }).withMessage('First Name must be between 2 and 50 characters').trim().escape(),
            check('lastname').not().isEmpty().withMessage("Last Name is required")
                .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters').trim().escape(),
            check('mobilenumber').not().isEmpty().withMessage("phone_no is required")
                .isMobilePhone().withMessage('Valid phone number is required').trim().escape(),
            check('iso_code').not().isEmpty().withMessage("ISO Code is required")
                .isLength({ min: 2, max: 3 }).withMessage('ISO Code must be 2 or 3 characters long').trim().escape(),
            check('country_code').not().isEmpty().withMessage("Country Code is required")
                .isLength({ min: 1, max: 4 }).withMessage('Country Code must be between 1 and 4 characters long').trim().escape(),
        ],
        checkForUnexpectedFields(["profile_image", "firstname", "lastname", "mobilenumber", "iso_code", "country_code"]),
        validation, verifyToken
    ];
}

exports.editProfile = () => {
    return [
        upload.fields([
            { name: "profile_image" },
        ]),
        [
            check("profile_image").custom((value, { req }) => {
                if (!req.files || !req.files.profile_image) {
                    return true; // No files to validate
                }
                if (req.files.profile_image.length > 1) {
                    req.files.profile_image.forEach(element => {
                        fs.unlinkSync(element.path);
                    });
                    throw new Error('Maximum 1 image allowed');
                }
                return true;
            }).optional(),
            check('firstname')
                .isLength({ min: 2, max: 50 }).withMessage('First Name must be between 2 and 50 characters')
                .trim().escape()
                .optional(),
            check('lastname')
                .isLength({ min: 2, max: 50 }).withMessage('Last Name must be between 2 and 50 characters')
                .trim().escape()
                .optional(),
            check("email")
                .isEmail().withMessage("Invalid email format")
                .optional(),
            check('mobilenumber')
                .isMobilePhone().withMessage('Valid phone number is required')
                .trim().escape()
                .optional(),
            check('iso_code')
                .isLength({ min: 2, max: 3 }).withMessage('ISO Code must be 2 or 3 characters long')
                .trim().escape()
                .optional(),
            check('country_code')
                .isLength({ min: 1, max: 4 }).withMessage('Country Code must be between 1 and 4 characters long')
                .trim().escape()
                .optional(),
            check('commission_percentage')
                .optional()
                .isFloat({ min: 0, max: 100 }).withMessage("Commission Percentage must be a number between 0 and 100")
                .toFloat(),
        ],
        checkForUnexpectedFields(["profile_image", "firstname", "lastname", "email", "mobilenumber", "iso_code", "country_code0", "commission_percentage"]),
        validation, verifyToken
    ];
}



console.log('out side of auth validation')
