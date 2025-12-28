const express = require('express');
const router = express.Router();
const { convertToPdf } = require('../controllers/photoToPdfController');
const upload = require('../config/photo.multer.config');

router.post(
  '/convert',
  upload.array('images', 50), // Max 50 images
  convertToPdf
);

module.exports = router;