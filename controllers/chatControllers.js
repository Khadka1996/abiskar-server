const { ChatMessage, Device } = require('../models/chatModel');
const Joi = require('joi');
const sanitizeHtml = require('sanitize-html');

// Guest sends message
const sendGuestMessage = async (req, res, next) => {
  try {
    console.log('sendGuestMessage: Request:', { body: req.body, deviceInfo: req.deviceInfo });
    
    // Check if device is blocked
    const device = await Device.findOne({ deviceId: req.deviceInfo.id });
    if (device?.isBlocked) {
      console.error('sendGuestMessage: Blocked device:', req.deviceInfo.id);
      return res.status(403).json({ error: 'Your device is blocked from sending messages' });
    }

    const schema = Joi.object({
      content: Joi.string().trim().min(1).max(1000).required(),
      recipientType: Joi.string().valid('admin', 'moderator').required(),
      recipientId: Joi.string().optional()
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
      console.error('sendGuestMessage: Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { content, recipientType, recipientId } = value;
    const { id: deviceId, name: senderName } = req.deviceInfo;

    // Ensure senderName is not null
    const finalSenderName = senderName && senderName.trim() ? senderName : 'Guest';
    console.log('sendGuestMessage: Creating message:', { deviceId, senderName: finalSenderName });

    // Sanitize content
    const sanitizedContent = sanitizeHtml(content, {
      allowedTags: [],
      allowedAttributes: {}
    });

    const message = new ChatMessage({
      content: sanitizedContent,
      deviceId,
      senderType: 'guest',
      senderId: deviceId,
      senderName: finalSenderName,
      recipientType,
      recipientId,
      read: false
    });

    await message.save();
    console.log('sendGuestMessage: Message saved:', message);
    res.status(201).json(message);
  } catch (error) {
    console.error('sendGuestMessage: Error:', error.message, { deviceId: req.deviceInfo?.id });
    res.status(500).json({ error: `Failed to send message: ${error.message}` });
    next(error);
  }
};

// Admin/Moderator sends message
const sendStaffMessage = async (req, res, next) => {
  try {
    const schema = Joi.object({
      content: Joi.string().trim().min(1).max(1000).required(),
      deviceId: Joi.string().required()
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
      console.error('sendStaffMessage: Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { content, deviceId } = value;
    const staff = req.user;

    // Verify device exists
    const device = await Device.findOne({ deviceId });
    if (!device) {
      console.error('sendStaffMessage: Device not found:', deviceId);
      return res.status(404).json({ error: 'Device not found' });
    }

    // Sanitize content
    const sanitizedContent = sanitizeHtml(content, {
      allowedTags: [],
      allowedAttributes: {}
    });

    const message = new ChatMessage({
      content: sanitizedContent,
      deviceId,
      senderType: staff.role,
      senderId: staff._id,
      senderName: staff.username,
      recipientType: 'guest',
      recipientId: deviceId,
      read: false
    });

    await message.save();
    res.status(201).json(message);
  } catch (error) {
    console.error('sendStaffMessage: Error:', error.message, { deviceId: req.body.deviceId });
    res.status(500).json({ error: `Failed to send staff message: ${error.message}` });
    next(error);
  }
};

// Get conversation with pagination
const getConversation = async (req, res, next) => {
  try {
    console.log('getConversation: Received request', req.query, req.params, req.deviceInfo);
    const schema = Joi.object({
      deviceId: Joi.string().optional(),
      since: Joi.string().isoDate().optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      senderType: Joi.string().valid('guest').optional() // New: filter by senderType
    });
    const { error, value } = schema.validate({ ...req.params, ...req.query });
    if (error) {
      console.error('getConversation: Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { deviceId: paramDeviceId, since, page, limit, senderType } = value;
    const deviceId = paramDeviceId || req.deviceInfo.id;
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'moderator';

    const query = {
      deviceId,
      ...(senderType && { senderType }) // Apply senderType filter if provided
    };
    if (!senderType) {
      // Include both guest and admin messages for staff or guest full conversation
      query.$or = [
        { deviceId, senderType: 'guest' },
        { deviceId, recipientType: 'guest' }
      ];
      if (!isStaff) {
        query.$or = [
          { deviceId, senderType: 'guest' },
          { recipientId: deviceId }
        ];
      }
    }
    if (since) {
      query.createdAt = { $gt: new Date(since) };
    }

    const skip = (page - 1) * limit;
    const totalMessages = await ChatMessage.countDocuments(query);
    const messages = await ChatMessage.find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit);

    const unreadCount = await ChatMessage.countDocuments({
      deviceId,
      senderType: 'guest',
      read: false
    });

    console.log('getConversation: Retrieved messages:', messages.length, { deviceId, page, limit });
    res.json({
      messages,
      unreadCount,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
        limit
      }
    });
  } catch (error) {
    console.error('getConversation: Error:', error.message, { deviceId: req.params.deviceId || req.deviceInfo?.id });
    res.status(500).json({ error: `Failed to fetch conversation: ${error.message}` });
    next(error);
  }
};

// Mark single message as read
const markMessageRead = async (req, res, next) => {
  try {
    const schema = Joi.object({
      messageId: Joi.string().required()
    });
    const { error, value } = schema.validate(req.params);
    if (error) {
      console.error('markMessageRead: Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { messageId } = value;
    const message = await ChatMessage.findByIdAndUpdate(
      messageId,
      { $set: { read: true } },
      { new: true }
    );
    if (!message) {
      console.error('markMessageRead: Message not found:', messageId);
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    console.error('markMessageRead: Error:', error.message, { messageId: req.params.messageId });
    res.status(500).json({ error: `Failed to mark message as read: ${error.message}` });
    next(error);
  }
};

// Mark all messages for a device as read
const markMessagesRead = async (req, res, next) => {
  try {
    const schema = Joi.object({
      deviceId: Joi.string().required()
    });
    const { error, value } = schema.validate(req.params);
    if (error) {
      console.error('markMessagesRead: Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { deviceId } = value;
    await ChatMessage.updateMany(
      { deviceId, senderType: 'guest', read: false },
      { $set: { read: true } }
    );

    console.log('markMessagesRead: Messages marked as read for device:', deviceId);
    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('markMessagesRead: Error:', error.message, { deviceId: req.params.deviceId });
    res.status(500).json({ error: `Failed to mark messages as read: ${error.message}` });
    next(error);
  }
};

// Rename device
const renameDevice = async (req, res, next) => {
  try {
    const schema = Joi.object({
      deviceId: Joi.string().required(),
      newName: Joi.string().trim().min(1).max(50).required()
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
      console.error('renameDevice: Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { deviceId, newName } = value;
    // Sanitize newName
    const sanitizedName = sanitizeHtml(newName, {
      allowedTags: [],
      allowedAttributes: {}
    });

    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: { name: sanitizedName } },
      { new: true }
    );

    if (!device) {
      console.error('renameDevice: Device not found:', deviceId);
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(device);
  } catch (error) {
    console.error('renameDevice: Error:', error.message, { deviceId: req.body.deviceId });
    res.status(500).json({ error: `Failed to rename device: ${error.message}` });
    next(error);
  }
};

// Block/unblock device
const toggleBlockDevice = async (req, res, next) => {
  try {
    const schema = Joi.object({
      deviceId: Joi.string().required(),
      isBlocked: Joi.boolean().required()
    });
    const { error, value } = schema.validate(req.body);
    if (error) {
      console.error('toggleBlockDevice: Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { deviceId, isBlocked } = value;
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { $set: { isBlocked } },
      { new: true }
    );

    if (!device) {
      console.error('toggleBlockDevice: Device not found:', deviceId);
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(device);
  } catch (error) {
    console.error('toggleBlockDevice: Error:', error.message, { deviceId: req.body.deviceId });
    res.status(500).json({ error: `Failed to update block status: ${error.message}` });
    next(error);
  }
};

// Get active devices
const getActiveDevices = async (req, res, next) => {
  try {
    const schema = Joi.object({
      lastHours: Joi.number().integer().min(1).max(720).default(24),
      search: Joi.string().trim().max(100).default(''),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    });
    const { error, value } = schema.validate(req.query);
    if (error) {
      console.error('getActiveDevices: Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { lastHours, search, page, limit } = value;
    const cutoffDate = new Date(Date.now() - lastHours * 60 * 60 * 1000);
    const skip = (page - 1) * limit;

    const devices = await Device.aggregate([
      {
        $match: {
          lastActive: { $gte: cutoffDate },
          name: { $regex: search, $options: 'i' },
          isBlocked: false // Exclude blocked devices
        }
      },
      {
        $lookup: {
          from: 'chatmessages',
          let: { deviceId: '$deviceId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$deviceId', '$$deviceId'] },
                createdAt: { $gte: cutoffDate }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: 'lastMessage'
        }
      },
      {
        $lookup: {
          from: 'chatmessages',
          let: { deviceId: '$deviceId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$deviceId', '$$deviceId'] },
                senderType: 'guest',
                read: false,
                createdAt: { $gte: cutoffDate }
              }
            },
            { $count: 'unreadCount' }
          ],
          as: 'unreadMessages'
        }
      },
      {
        $addFields: {
          lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
          unreadCount: { $ifNull: [{ $arrayElemAt: ['$unreadMessages.unreadCount', 0] }, 0] }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    const totalDevices = await Device.countDocuments({
      lastActive: { $gte: cutoffDate },
      name: { $regex: search, $options: 'i' },
      isBlocked: false
    });

    const totalUnread = await ChatMessage.countDocuments({
      senderType: 'guest',
      read: false,
      createdAt: { $gte: cutoffDate }
    });

    res.json({
      users: devices.map((device) => ({
        _id: device.deviceId,
        nickname: device.name,
        deviceType: device.type,
        lastMessage: device.lastMessage,
        unreadCount: device.unreadCount,
        isBlocked: device.isBlocked,
        lastActive: device.lastActive
      })),
      totalUnread,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalDevices / limit),
        totalDevices,
        limit
      }
    });
  } catch (error) {
    console.error('getActiveDevices: Error:', error.message, { search: req.query.search });
    res.status(500).json({ error: `Failed to fetch active devices: ${error.message}` });
    next(error);
  }
};

// Get all received guest messages
const getReceivedMessages = async (req, res, next) => {
  try {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20)
    });
    const { error, value } = schema.validate(req.query);
    if (error) {
      console.error('getReceivedMessages: Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { page, limit } = value;
    const skip = (page - 1) * limit;

    const messages = await ChatMessage.find({ senderType: 'guest' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalMessages = await ChatMessage.countDocuments({ senderType: 'guest' });
    const unreadCount = await ChatMessage.countDocuments({
      senderType: 'guest',
      read: false
    });

    console.log('getReceivedMessages: Retrieved messages:', messages.length, { page, limit });
    res.json({
      messages,
      unreadCount,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMessages / limit),
        totalMessages,
        limit
      }
    });
  } catch (error) {
    console.error('getReceivedMessages: Error:', error.message);
    res.status(500).json({ error: `Failed to fetch received messages: ${error.message}` });
    next(error);
  }
};

// Get user details
const getUserDetails = async (req, res, next) => {
  try {
    const schema = Joi.object({
      userId: Joi.string().required()
    });
    const { error, value } = schema.validate(req.params);
    if (error) {
      console.error('getUserDetails: Validation error:', error.details[0].message);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { userId } = value;
    const device = await Device.findOne({ deviceId: userId });
    if (!device) {
      console.error('getUserDetails: Device not found:', userId);
      return res.status(404).json({ error: 'Device not found' });
    }

    const lastMessage = await ChatMessage.findOne({
      deviceId: userId,
      senderType: 'guest'
    }).sort({ createdAt: -1 });

    const unreadCount = await ChatMessage.countDocuments({
      deviceId: userId,
      senderType: 'guest',
      read: false
    });

    res.json({
      user: {
        _id: device.deviceId,
        nickname: device.name,
        deviceType: device.type,
        lastMessage: lastMessage
          ? { content: lastMessage.content, createdAt: lastMessage.createdAt }
          : null,
        unreadCount,
        isBlocked: device.isBlocked,
        lastActive: device.lastActive
      }
    });
  } catch (error) {
    console.error('getUserDetails: Error:', error.message, { userId: req.params.userId });
    res.status(500).json({ error: `Failed to fetch user details: ${error.message}` });
    next(error);
  }
};

module.exports = {
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
};