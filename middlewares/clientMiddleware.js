const mongoose = require('mongoose');
const validator = require('validator');

// Middleware to validate client data for POST and PUT requests
const validateClientData = (req, res, next) => {
  const { name, email, phone, country, project } = req.body;

  // Check required fields
  if (!name || !email || !phone || !country || !project) {
    return res.status(400).json({ message: 'All fields (name, email, phone, country, project) are required' });
  }

  // Validate email format
  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  // Validate project fields
  if (!project.name || !project.deadline || project.progress == null || project.budget == null) {
    return res.status(400).json({ message: 'Project name, deadline, progress, and budget are required' });
  }

  // Validate progress (0-100)
  if (typeof project.progress !== 'number' || project.progress < 0 || project.progress > 100) {
    return res.status(400).json({ message: 'Progress must be a number between 0 and 100' });
  }

  // Validate budget (non-negative)
  if (typeof project.budget !== 'number' || project.budget < 0) {
    return res.status(400).json({ message: 'Budget must be a non-negative number' });
  }

  // Validate deadline (valid date)
  if (!validator.isDate(project.deadline)) {
    return res.status(400).json({ message: 'Invalid deadline format' });
  }

  // Validate completed (boolean)
  if (project.completed != null && typeof project.completed !== 'boolean') {
    return res.status(400).json({ message: 'Completed must be a boolean' });
  }

  next();
};

// Middleware to validate MongoDB ObjectId
const validateClientId = (req, res, next) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'Invalid client ID' });
  }
  next();
};

// Middleware to validate bulk delete request
const validateBulkDelete = (req, res, next) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'IDs must be a non-empty array' });
  }
  if (!ids.every((id) => mongoose.isValidObjectId(id))) {
    return res.status(400).json({ message: 'All IDs must be valid MongoDB ObjectIds' });
  }
  next();
};

module.exports = {
  validateClientData,
  validateClientId,
  validateBulkDelete,
};