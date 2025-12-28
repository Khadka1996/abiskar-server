const { check, validationResult } = require('express-validator');

const validateMessageInput = [
  // Required fields
  check('name', 'Name is required').not().isEmpty().trim().escape(),
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('message', 'Message is required').not().isEmpty().trim().escape(),
  
  // Optional fields
  check('phone', 'Please include a valid phone number').optional().trim().escape(),
  check('service', 'Service name must be a string').optional().trim().escape(),
  check('serviceId', 'Service ID must be a valid ID').optional().trim().escape(),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    // Set default values if not provided
    req.body.service = req.body.service || "General Inquiry";
    req.body.serviceId = req.body.serviceId || null;
    
    next();
  }
];

// Keep these validations unchanged as they're for admin operations
const validateMessageStatus = [
  check('status', 'Status is required').not().isEmpty().isIn(['new', 'read', 'responded', 'archived']),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

const validateAssignMessage = [
  check('assignedTo', 'User ID is required').not().isEmpty().isMongoId(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

const validateRespondToMessage = [
  check('responseText', 'Response text is required').not().isEmpty().trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

module.exports = {
  validateMessageInput,
  validateMessageStatus,
  validateAssignMessage,
  validateRespondToMessage
};