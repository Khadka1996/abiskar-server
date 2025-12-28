const { body, param } = require("express-validator");
const User = require("../models/userModels");

// Utility function for password complexity check
const isStrongPassword = (value) => {
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongRegex.test(value);
};

exports.validateRegister = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3-30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers and underscores")
    // .custom(async (username) => {
    //   const user = await User.findOne({ username });
    //   if (user) throw new Error("Username already in use");
    // })
    .escape(),

  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .custom(async (email) => {
      const user = await User.findOne({ email });
      if (user) throw new Error("Email already in use");
    }),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .custom((value) => isStrongPassword(value))
    .withMessage("Password must contain at least one uppercase, one lowercase, one number and one special character")
    .escape(),

  body("confirmPassword")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Passwords do not match")
];

exports.validateLogin = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .escape()
];

exports.validateUpdateUser = [
  body("email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .custom(async (email, { req }) => {
      const user = await User.findOne({ email });
      if (user && user._id.toString() !== req.user.id) {
        throw new Error("Email already in use by another account");
      }
    }),

  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be 3-30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers and underscores")
    .custom(async (username, { req }) => {
      const user = await User.findOne({ username });
      if (user && user._id.toString() !== req.user.id) {
        throw new Error("Username already in use by another account");
      }
    })
    .escape(),

  body("currentPassword")
    .if(body("password").exists())
    .notEmpty()
    .withMessage("Current password is required for updates")
];

exports.validateChangePassword = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required")
    .escape(),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .custom((value) => isStrongPassword(value))
    .withMessage("Password must contain at least one uppercase, one lowercase, one number and one special character")
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage("New password must be different from current password")
    .escape(),

  body("confirmPassword")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("Passwords do not match")
];

exports.validateForgotPassword = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail()
    .custom(async (email) => {
      const user = await User.findOne({ email });
      if (!user) throw new Error("No account found with this email");
    })
];

exports.validateResetPassword = [
  param("token")
    .notEmpty()
    .withMessage("Reset token is invalid or has expired"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .custom((value) => isStrongPassword(value))
    .withMessage("Password must contain at least one uppercase, one lowercase, one number and one special character")
    .escape(),

  body("confirmPassword")
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage("Passwords do not match")
];

// Additional validators for admin operations
exports.validateChangeUserRole = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID"),

  body("role")
    .isIn(["user", "moderator", "admin"])
    .withMessage("Invalid role specified")
];

exports.validateUserIdParam = [
  param("id")
    .isMongoId()
    .withMessage("Invalid user ID")
];