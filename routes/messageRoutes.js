const express = require('express');
const router = express.Router();
const {
  createMessage, // Public
  getMessages, getMessage, updateMessageStatus, // Admin
  assignMessage, respondToMessage, deleteMessage // Admin
} = require('../controllers/messageController');
const {
  validateMessageInput,
  validateMessageStatus,
  validateAssignMessage,
  validateRespondToMessage
} = require('../middlewares/messageValidate');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware.js');

// ======================
// PUBLIC ROUTES (NO AUTH)
// ======================
router.post('/', validateMessageInput, createMessage);

// ======================
// PROTECTED ROUTES (REQUIRE AUTH)
// ======================
const protectedMessageRouter = express.Router();

// Apply auth to ALL routes in this sub-router
protectedMessageRouter.use(authMiddleware);
protectedMessageRouter.use(authorizeRoles('admin', 'moderator'));

// Protected routes
protectedMessageRouter.get('/', getMessages);
protectedMessageRouter.get('/:id', getMessage);
protectedMessageRouter.put('/:id/status', validateMessageStatus, updateMessageStatus);
protectedMessageRouter.put('/:id/assign', validateAssignMessage, assignMessage);
protectedMessageRouter.put('/:id/respond', validateRespondToMessage, respondToMessage);
protectedMessageRouter.delete('/:id', deleteMessage);

// Mount protected routes under the same path
router.use('/', protectedMessageRouter);

module.exports = router;