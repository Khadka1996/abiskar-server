const photoToPdfService = require('../services/photoToPdfService');
const { logger } = require('../utils/logger.util');
const { cleanupFiles } = require('../utils/fileUtils');
exports.convertToPdf = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No images uploaded' 
      });
    }

    const gridSize = parseInt(req.body.gridSize) || 1;
    const images = req.files.map(file => ({
      path: file.path,
      originalname: file.originalname
    }));

    const pdfPath = await photoToPdfService.createPdfFromImages(images, gridSize);

    res.download(pdfPath, `photos-${Date.now()}.pdf`, (err) => {
      cleanupFiles(pdfPath, ...images.map(img => img.path));
      if (err) logger.error('Download error:', err);
    });

  } catch (error) {
    logger.error('Conversion error:', error);
    cleanupFiles(...req.files?.map(f => f.path));
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to create PDF'
    });
  }
};