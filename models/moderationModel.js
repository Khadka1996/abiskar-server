//moderationModel.js
const mongoose = require('mongoose');

const moderationSchema = new mongoose.Schema({
  contentId: { type: mongoose.Schema.Types.ObjectId, required: true },
  contentType: { type: String, enum: ['comment', 'post'] },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Moderation', moderationSchema);