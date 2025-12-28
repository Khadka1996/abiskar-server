const express = require('express');
const router = express.Router();
const pdfToJpgController = require('../controllers/pdfToJpgController');

router.post('/convert', ...pdfToJpgController.convert);

module.exports = router;