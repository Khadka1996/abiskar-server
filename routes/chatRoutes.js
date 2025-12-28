const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const deviceMiddleware = require('../middlewares/deviceMiddleware');
const {
  sendGuestMessage,
  sendStaffMessage,
  getConversation,
  markMessageRead,
  markMessagesRead,
  renameDevice,
  toggleBlockDevice,
  getActiveDevices,
  getReceivedMessages,
  getUserDetails
} = require('../controllers/chatControllers');
const validator = require('validator');

// Rate limiters
const guestMessageRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many messages sent, please try again later'
});

const guestRequestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later'
});

const staffRequestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: 'Too many requests, please try again later'
});

// Middleware to validate deviceId or userId
const validateDeviceId = (req, res, next) => {
  const { deviceId, userId } = req.params;
  const id = deviceId || userId;
  if (id && !validator.isUUID(id, 4)) {
    return res.status(400).json({ error: 'Invalid device ID format' });
  }
  next();
};

// Guest endpoints (no auth required)
router.post('/guest/send', guestMessageRateLimit, deviceMiddleware, sendGuestMessage);
router.get('/guest/conversation', guestRequestRateLimit, deviceMiddleware, getConversation);
router.patch('/device/rename', guestRequestRateLimit, deviceMiddleware, renameDevice);

// Staff endpoints (auth removed)
router.post('/staff/send', staffRequestRateLimit, sendStaffMessage);
router.get('/staff/conversation/:deviceId', staffRequestRateLimit, validateDeviceId, getConversation);
router.get('/staff/devices', staffRequestRateLimit, getActiveDevices);
router.patch('/messages/:messageId/read', staffRequestRateLimit, markMessageRead);
router.patch('/users/:deviceId/mark-read', staffRequestRateLimit, validateDeviceId, markMessagesRead);
router.patch('/device/block', staffRequestRateLimit, toggleBlockDevice);
router.get('/messages/received', staffRequestRateLimit, getReceivedMessages);
router.get('/users/:userId', staffRequestRateLimit, validateDeviceId, getUserDetails);

// Centralized error handler
router.use((error, req, res, next) => {
  console.error('Chat route error:', error.message, {
    path: req.originalUrl,
    method: req.method
  });
  res.status(error.status || 500).json({
    error: error.message || 'An unexpected error occurred'
  });
});

module.exports = router;
