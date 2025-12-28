const Message = require('../models/messageModel');
const asyncHandler = require('express-async-handler');
const { sendNewMessageEmail } = require('../services/emailService');
const Service = require('../models/serviceModal');

// @desc    Create a new message
// @route   POST /api/messages
// @access  Public
const createMessage = asyncHandler(async (req, res) => {
  const { name, email, phone, message, serviceId } = req.body;

  try {
    let serviceName = "General Inquiry"; // Default
    
    // If serviceId is provided, fetch the actual service name
    if (serviceId) {
      const service = await Service.findById(serviceId).select('name');
      if (service) {
        serviceName = service.name; // Use the real name from Service model
      }
    }

    const newMessage = await Message.create({
      name,
      email,
      phone: phone || null,
      message,
      service: serviceName, // Now uses either the real name or "General Inquiry"
      serviceId: serviceId || null // Optional
    });

    // Email logic (unchanged)
    if (process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true') {
      sendNewMessageEmail({
        name,
        email,
        service: serviceName, // Use the resolved name
        message
      }).catch(emailError => {
        console.error('Email notification failed:', emailError.message);
      });
    }

    res.status(201).json({
      success: true,
      data: newMessage,
      notification: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true' ? 
                   'pending' : 'disabled'
    });

  } catch (error) {
    console.error('Message creation failed:', error);
    res.status(400).json({
      success: false,
      error: 'Message submission failed',
      details: error.message
    });
  }
});

// @desc    Get all messages (with filters)
// @route   GET /api/messages
// @access  Private/Admin
const getMessages = asyncHandler(async (req, res) => {
  try {
    const { status, serviceId, assignedTo, dateFrom, dateTo } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (serviceId) filter.serviceId = serviceId;
    if (assignedTo) filter.assignedTo = assignedTo;
    
    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .populate('assignedTo', 'username email')
      .populate('response.respondedBy', 'username email');

    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve messages'
    });
  }
});

// @desc    Get single message with details
// @route   GET /api/messages/:id
// @access  Private/Admin
const getMessage = asyncHandler(async (req, res) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('assignedTo', 'username email role')
      .populate('response.respondedBy', 'username email');

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Failed to fetch message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve message'
    });
  }
});

// @desc    Update message status
// @route   PUT /api/messages/:id/status
// @access  Private/Admin
const updateMessageStatus = asyncHandler(async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    ).populate('assignedTo', 'username email');

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Failed to update status:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid status update'
    });
  }
});

// @desc    Assign message to staff member
// @route   PUT /api/messages/:id/assign
// @access  Private/Admin
const assignMessage = asyncHandler(async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { assignedTo: req.body.assignedTo },
      { new: true, runValidators: true }
    ).populate('assignedTo', 'username email role');

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Failed to assign message:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid assignment'
    });
  }
});

// @desc    Add response to message
// @route   PUT /api/messages/:id/respond
// @access  Private/Admin
const respondToMessage = asyncHandler(async (req, res) => {
  try {
    const updateData = {
      status: 'responded',
      response: {
        text: req.body.responseText,
        respondedAt: Date.now(),
        respondedBy: req.user.id
      }
    };

    const message = await Message.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('response.respondedBy', 'username email')
     .populate('assignedTo', 'username email');

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Failed to add response:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid response'
    });
  }
});

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private/Admin
const deleteMessage = asyncHandler(async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    res.json({
      success: true,
      data: { id: req.params.id }
    });
  } catch (error) {
    console.error('Failed to delete message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    });
  }
});

module.exports = {
  createMessage,
  getMessages,
  getMessage,
  updateMessageStatus,
  assignMessage,
  respondToMessage,
  deleteMessage
};