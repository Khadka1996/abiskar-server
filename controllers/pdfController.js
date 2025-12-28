const pdfService = require('../services/pdfService');
const { logger } = require('../utils/logger.util');
const fs = require('fs');
const path = require('path');

const compressPDF = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    const { compressionLevel = 'medium' } = req.body;
    const { path: inputPath, originalname } = req.file;
    
    logger.info(`Starting compression for: ${originalname}`);
    
    const outputPath = await pdfService.compressPDF(
      inputPath, 
      compressionLevel,
      originalname
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="compressed_${originalname}"`);

    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      try {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        logger.info(`Cleaned up temporary files for: ${originalname}`);
      } catch (err) {
        logger.error(`Error cleaning files: ${err.message}`);
      }
    });

  } catch (error) {
    logger.error(`Compression error: ${error.message}`);
    next(error);
  }
};

const mergePDFs = async (req, res, next) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least 2 PDF files to merge'
      });
    }

    const filePaths = req.files.map(file => file.path);
    const originalNames = req.files.map(file => file.originalname).join(', ');
    const outputFilename = `merged_${Date.now()}.pdf`;

    logger.info(`Starting merge for files: ${originalNames}`);

    const outputPath = await pdfService.mergePDFs(filePaths, outputFilename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);

    const fileStream = fs.createReadStream(outputPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      try {
        filePaths.forEach(filePath => fs.unlinkSync(filePath));
        fs.unlinkSync(outputPath);
        logger.info(`Cleaned up merged files: ${outputFilename}`);
      } catch (err) {
        logger.error(`Error cleaning files: ${err.message}`);
      }
    });

  } catch (error) {
    logger.error(`Merge error: ${error.message}`);
    next(error);
  }
};

const splitPDF = async (req, res, next) => {
  let tempFiles = [];
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No file uploaded' 
      });
    }

    const { path: inputPath, originalname } = req.file;
    const { ranges, splitMode = 'custom' } = req.body;

    // Validate inputs
    if (splitMode === 'custom' && (!ranges || typeof ranges !== 'string')) {
      return res.status(400).json({
        success: false,
        message: 'For custom split mode, page ranges must be provided'
      });
    }

    logger.info(`Starting PDF split for: ${originalname}`, {
      splitMode,
      ranges: splitMode === 'custom' ? ranges : 'all pages'
    });

    // Process the splitting
    const result = await pdfService.splitPDF({
      inputPath,
      originalname,
      ranges: splitMode === 'custom' ? ranges : null,
      splitMode,
      outputType: 'zip'
    });

    // Track all temporary files for cleanup
    tempFiles = [inputPath, result.outputPath, ...(result.tempFiles || [])];

    // Set response headers for zip download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="split_${path.parse(originalname).name}.zip"`);
    
    // Stream the zip file to the client
    const fileStream = fs.createReadStream(result.outputPath);
    fileStream.pipe(res);

    fileStream.on('end', () => {
      logger.info(`Successfully sent split PDF zip for: ${originalname}`);
      cleanupFiles(...tempFiles);
    });

    fileStream.on('error', (err) => {
      logger.error(`Stream error during split PDF download: ${err.message}`);
      cleanupFiles(...tempFiles);
    });

  } catch (error) {
    logger.error(`Split PDF error: ${error.message}`, {
      stack: error.stack,
      originalname: req.file?.originalname
    });
    
    // Cleanup any created files
    cleanupFiles(...tempFiles);
    
    // Send error response
    res.status(500).json({
      success: false,
      message: 'Failed to split PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function for file cleanup
const cleanupFiles = (...filePaths) => {
  filePaths.forEach(filePath => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up file: ${filePath}`);
      } catch (err) {
        logger.error(`Error cleaning file ${filePath}:`, err);
      }
    }
  });
};

module.exports = {
  compressPDF,
  mergePDFs,
  splitPDF
};
