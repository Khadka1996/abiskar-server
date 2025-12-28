const mongoose = require('mongoose');

// Define the Project schema (nested within Client)
const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Project name is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  deadline: {
    type: Date,
    required: [true, 'Project deadline is required'],
  },
  progress: {
    type: Number,
    required: [true, 'Project progress is required'],
    min: [0, 'Progress must be at least 0'],
    max: [100, 'Progress cannot exceed 100'],
  },
  budget: {
    type: Number,
    required: [true, 'Project budget is required'],
    min: [0, 'Budget must be non-negative'],
  },
});

// Define the Client schema
const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true,
  },
  project: {
    type: projectSchema,
    required: [true, 'Project details are required'],
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

// Create and export the Client model
const Client = mongoose.model('Client', clientSchema);

module.exports = Client;