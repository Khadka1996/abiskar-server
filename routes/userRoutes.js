const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { 
  authMiddleware, 
  authorizeRoles,
  handleTokenRefresh,
  handleLogout,
} = require("../middlewares/authMiddleware.js");
const { 
  validateRegister,
  validateLogin,
  validateUpdateUser,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateUserIdParam,
  validateChangeUserRole
} = require("../middlewares/userValidation");

// Security Middleware


// Public Routes
router.post("/register", 
  validateRegister, 
  userController.register
);

router.post("/login", 
  validateLogin, 
  userController.login
);

router.post("/auth/refresh",  // Changed endpoint path
  handleTokenRefresh
);

router.post("/forgot-password", 
  validateForgotPassword,
  userController.forgotPassword
);

router.post("/reset-password/:token", 
  validateResetPassword,
  userController.resetPassword
);

// Protected Routes (All Authenticated Users)
router.use(authMiddleware);

// Session Management
router.post("/logout", 
  handleLogout
);

// User Profile
router.get('/me', 
  userController.getProfile
);

router.patch("/profile", 
  validateUpdateUser,
  userController.updateProfile
);

// Password Management
router.post("/change-password", 
  validateChangePassword,
  userController.changePassword
);

// Moderator Routes
router.use(authorizeRoles("moderator", "admin"));

router.get("/moderation/pending", 
  userController.getPendingModerationItems
);

router.post("/moderation/approve/:id", 
  validateUserIdParam,  // Added validation
  userController.approveContent
);

// Admin-Only Routes
router.use(authorizeRoles("admin"));

// User Management
router.get("/", 
  userController.getAllUsers
);

router.get("/:id", 
  validateUserIdParam,
  userController.getUserById
);

router.patch("/:id/role", 
  validateUserIdParam,
  validateChangeUserRole,
  userController.changeUserRole
);

router.delete("/:id", 
  validateUserIdParam,
  userController.deleteUser
);

// Audit Logs - moved under admin routes and renamed path
router.get("/admin/audit-logs", 
  userController.getAuditLogs
);

// Security Headers
router.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

module.exports = router;