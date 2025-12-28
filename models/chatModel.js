const mongoose = require('mongoose');

// ========================
// CHAT MESSAGE SCHEMA
// ========================
const chatMessageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    minlength: [1, 'Message cannot be empty'],
    maxlength: [1000, 'Message exceeds 1000 character limit'],
    validate: {
      validator: (v) => v.trim().length > 0,
      message: 'Message cannot be only whitespace'
    }
  },
  senderType: {
    type: String,
    enum: ['guest', 'admin', 'moderator'],
    required: [true, 'Sender type is required'],
    immutable: true
  },
  senderId: {
    type: String,
    required: [true, 'Sender ID is required'],
    immutable: true
  },
  senderName: {
    type: String,
    required: [true, 'Sender name is required'],
    trim: true,
    minlength: 1,
    maxlength: 50
  },
  recipientType: {
    type: String,
    enum: ['guest', 'admin', 'moderator'],
    required: [true, 'Recipient type is required']
  },
  recipientId: {
    type: String,
    validate: {
      validator: function(v) {
        return this.recipientType === 'guest' ? !!v : true;
      },
      message: 'Recipient ID is required when messaging guests'
    }
  },
  deviceId: {
    type: String,
    required: [true, 'Device ID is required'],
    index: true,
    immutable: true
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: '7d' }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true } 
});

// ========================
// DEVICE SCHEMA
// ========================
const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: [true, 'Device ID is required'],
    unique: true,
    immutable: true
  },
  name: {
    type: String,
    required: [true, 'Device name is required'],
    trim: true,
    minlength: 1,
    maxlength: 50,
    validate: {
      validator: (v) => !/^Guest-[a-f0-9]{4}$/i.test(v),
      message: 'Default guest names cannot be manually set'
    }
  },
  type: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    required: [true, 'Device type is required']
  },
  lastActive: {
    type: Date,
    default: Date.now,
    index: { expires: '30d' }
  },
  isBlocked: {
    type: Boolean,
    default: false,
    index: true
  }
}, { timestamps: true });

// ========================
// INDEXES
// ========================
chatMessageSchema.index({ deviceId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1, createdAt: -1 });
chatMessageSchema.index({ recipientId: 1, read: 1 });

deviceSchema.index({ name: 'text' });
deviceSchema.index({ lastActive: -1, isBlocked: 1 });

// ========================
// VIRTUALS
// ========================
chatMessageSchema.virtual('chatDirection').get(function() {
  return `${this.senderType}-to-${this.recipientType}`;
});

// ========================
// MODELS
// ========================
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
const Device = mongoose.model('Device', deviceSchema);

// Remove erroneous unique indexes
ChatMessage.collection.dropIndex('nickname_1', (err) => {
  if (err && err.code !== 27) { // 27 means index not found
    console.error('Failed to drop nickname_1 index:', err);
  } else {
    console.log('Dropped nickname_1 index or it did not exist');
  }
});
ChatMessage.collection.dropIndex('senderName_1', (err) => {
  if (err && err.code !== 27) {
    console.error('Failed to drop senderName_1 index:', err);
  } else {
    console.log('Dropped senderName_1 index or it did not exist');
  }
});

module.exports = { ChatMessage, Device };