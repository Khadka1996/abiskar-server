const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true, // Review content (text)
    trim: true,
  },
  photo: {
    type: String, // URL of the photo associated with the review
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the user who created the review (admin or moderator)
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'moderator'],
    required: true, // Ensures that only admins or moderators can create reviews
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically set to the current date when the review is created
  },
  updatedAt: {
    type: Date,
    default: Date.now, // Automatically set to the current date when the review is updated
  },
}, { timestamps: true });

// Pre-save hook to update `updatedAt`
ReviewSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes to optimize search and sorting functionality
ReviewSchema.index({ createdAt: -1 }); // Sort by created date (newest first)
ReviewSchema.index({ updatedAt: -1 }); // Sort by updated date (newest first)

// Create the model
const Review = mongoose.model('Review', ReviewSchema);

module.exports = Review;
