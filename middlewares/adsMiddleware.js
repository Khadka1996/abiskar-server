const { body, validationResult } = require('express-validator');

// Middleware for validating advertisement data
exports.validateAdvertisement = [
  body('websiteLink')
    .isURL()
    .withMessage('Valid website link is required'),
  body('imagePath')
    .notEmpty()
    .withMessage('Image path is required'),
  body('position')
    .isIn([
      'top_banner',
      'sidebar_top',
      'sidebar_bottom',
      'footer',
      'popup_ad',
      'homepage_top',
      'homepage_bottom',
      'article_sidebar',
      'article_footer',
      'mobile_popup',
    ])
    .withMessage('Invalid advertisement position'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  },
];
