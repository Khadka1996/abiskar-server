const mongoose = require('mongoose');

const CountrySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,  // Country name is required
    unique: true,    // Ensure country name is unique
    trim: true,      // Remove leading/trailing spaces
  },
  photo: {
    type: String,    // URL or path to the country's photo
    required: true,  // Photo is required
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically set to the current date when a country is created
  },
  updatedAt: {
    type: Date,
    default: Date.now, // Automatically set to the current date when a country is updated
  },
}, { timestamps: true });

// Pre-save hook to update `updatedAt`
CountrySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index to optimize search by country name
CountrySchema.index({ name: 1 }); // Sort by country name

// Create the model
const Country = mongoose.model('Country', CountrySchema);

module.exports = Country;
