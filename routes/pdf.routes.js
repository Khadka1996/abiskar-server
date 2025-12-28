const express = require('express');
const router = express.Router();
const upload = require('../config/multer.config');
const pdfController = require('../controllers/pdfController');

router.post(
  '/compress',
  upload.single('pdfFile'),
  pdfController.compressPDF
);

router.post(
  '/merge',
  upload.array('pdfFiles'), 
  pdfController.mergePDFs
);

router.post(
  '/split',
  upload.single('pdfFile'), 
  pdfController.splitPDF
);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date().toISOString() 
  });
});

module.exports = router;