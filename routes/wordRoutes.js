const express = require('express');
const router = express.Router();
const { convertToWord } = require('../controllers/wordController');
const upload = require('../config/multer.config');

router.post(
  '/convert-word',
  upload.single('pdfFile'),
  convertToWord
);

module.exports = router;