const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const { cleanupFiles, ensureDirectory, validatePdfFile } = require('../utils/fileUtils');

class PdfConversionService {
  constructor() {
    this.tempDir = path.join(__dirname, '../../temp/jpg_output');
    ensureDirectory(this.tempDir);
  }

  async convertPdfToJpg(pdfPath, quality = 90) {
    if (!validatePdfFile(pdfPath)) {
      throw new Error('Invalid PDF file');
    }

    const pdfBytes = await fs.promises.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();
    const outputFiles = [];

    // Create a temporary directory for this conversion
    const conversionDir = path.join(this.tempDir, `conv-${Date.now()}`);
    ensureDirectory(conversionDir);

    try {
      // Convert each page to JPG
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i);
        const { width, height } = page.getSize();
        
        // Render page to image
        const jpegPath = path.join(conversionDir, `page-${i + 1}.jpg`);
        const pngBuffer = await page.renderToPng();
        
        // Convert to JPG with specified quality
        await sharp(pngBuffer)
          .jpeg({ quality: parseInt(quality) })
          .toFile(jpegPath);
        
        outputFiles.push(jpegPath);
      }

      // Determine output format (single JPG or ZIP)
      let result;
      if (outputFiles.length === 1) {
        // Single file - return it directly
        result = {
          path: outputFiles[0],
          filename: path.basename(pdfPath, '.pdf') + '.jpg',
          type: 'single'
        };
      } else {
        // Multiple files - create a ZIP
        const zip = new AdmZip();
        outputFiles.forEach(file => {
          zip.addLocalFile(file);
        });
        
        const zipPath = path.join(conversionDir, 'converted.zip');
        await zip.writeZipPromise(zipPath);
        
        result = {
          path: zipPath,
          filename: path.basename(pdfPath, '.pdf') + '-converted.zip',
          type: 'zip'
        };
        
        // Clean up individual JPGs since they're in the ZIP now
        cleanupFiles(...outputFiles);
      }

      return result;
    } catch (error) {
      // Clean up on error
      cleanupFiles(...outputFiles);
      throw error;
    }
  }

  async cleanupConversionFiles(filePath) {
    try {
      const dirPath = path.dirname(filePath);
      cleanupFiles(filePath);
      
      // Remove the directory if it's empty
      if (fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0) {
        fs.rmdirSync(dirPath);
      }
    } catch (error) {
      console.error('Error cleaning up conversion files:', error);
    }
  }
}

module.exports = new PdfConversionService();