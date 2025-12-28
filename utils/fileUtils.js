const fs = require('fs');
const path = require('path');

// Your existing function
const cleanDirectory = (directory) => {
  if (!fs.existsSync(directory)) return;

  fs.readdirSync(directory).forEach(file => {
    const filePath = path.join(directory, file);
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Error deleting file ${filePath}:`, err);
    }
  });
};

// New functions to add
const cleanupFiles = (...files) => {
  files.forEach(file => {
    try {
      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`Cleaned up: ${file}`);
      }
    } catch (err) {
      console.error(`Error cleaning ${file}:`, err);
    }
  });
};

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const validatePdfFile = (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    // Simple PDF header check (first 4 bytes should be '%PDF')
    return buffer.length > 4 && buffer.slice(0, 4).toString() === '%PDF';
  } catch (err) {
    return false;
  }
};

module.exports = {
  cleanDirectory, 
  cleanupFiles,   
  ensureDirectory,
  validatePdfFile
};