const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically set to the current date when a photo is created
  },
  updatedAt: {
    type: Date,
    default: Date.now, // Automatically set to the current date when a photo is updated
  },
}, { timestamps: true });

// Pre-save hook to update `updatedAt`
PhotoSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes to optimize search and sorting functionality
PhotoSchema.index({ createdAt: -1 }); // Sort by created date (newest first)
PhotoSchema.index({ updatedAt: -1 }); // Sort by updated date (newest first)

// Create the model
const Photo = mongoose.model('Photo', PhotoSchema);

module.exports = Photo;
