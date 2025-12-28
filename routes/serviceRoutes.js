// routes/serviceRoutes.js
const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/serviceController");
const { 
  authMiddleware, 
  authorizeRoles 
} = require("../middlewares/authMiddleware.js");
const {
  validateServiceCreate,
  validateServiceUpdate,
  validateServiceIdParam,
  validateServiceSlugParam
} = require("../middlewares/serviceValidation");

// Public Routes
router.get("/", serviceController.getAllServices);
router.get("/icons", serviceController.getAvailableIcons);
router.get("/:slug", validateServiceSlugParam, serviceController.getServiceBySlug);

// Protected Routes (All Authenticated Users)
router.use(authMiddleware);

router.post("/", validateServiceCreate, serviceController.createService);
router.put("/:id", validateServiceIdParam, validateServiceUpdate, serviceController.updateService);

// Moderator+ Routes
router.use(authorizeRoles("moderator", "admin"));
router.patch("/:id/approve", validateServiceIdParam, serviceController.approveService);

// Admin-Only Routes
router.use(authorizeRoles("admin"));
router.delete("/:id", validateServiceIdParam, serviceController.deleteService);
router.get("/admin/statistics", serviceController.getServiceStatistics);

// Security Headers Middleware
router.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

module.exports = router;