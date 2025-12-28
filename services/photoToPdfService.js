const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const { cleanupFiles } = require('../utils/fileUtils');

class PhotoToPdfService {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp/processing');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async createPdfFromImages(images, gridSize = 1) {
    const pdfDoc = await PDFDocument.create();
    const imagesPerPage = Math.min(Math.max(1, gridSize), 4);
    const totalPages = Math.ceil(images.length / imagesPerPage);

    // Process all images first
    const processedImages = await Promise.all(
      images.map(async (img) => {
        return this.processImageForPdf(img.path);
      })
    );

    // Add pages with images
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      const pageImages = processedImages.slice(
        pageNum * imagesPerPage,
        (pageNum + 1) * imagesPerPage
      );

      const page = pdfDoc.addPage([612, 792]); // Letter size (8.5x11 inches)
      await this.addImagesToPage(page, pageImages, imagesPerPage);
    }

    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(this.tempDir, `photos-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    return outputPath;
  }

  async processImageForPdf(imagePath) {
    try {
      // Convert image to PNG buffer (pdf-lib works best with PNG)
      const pngBuffer = await sharp(imagePath)
        .toFormat('png')
        .toBuffer();

      return pngBuffer;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

  async addImagesToPage(page, imageBuffers, imagesPerPage) {
    const { width, height } = page.getSize();
    const margin = 36;
    const contentWidth = width - margin * 2;
    const contentHeight = height - margin * 2;

    const cols = Math.min(imagesPerPage, 2);
    const rows = Math.ceil(imagesPerPage / cols);
    const cellWidth = contentWidth / cols;
    const cellHeight = contentHeight / rows;

    const pdfDoc = page.doc;

    // Embed all images first
    const embeddedImages = await Promise.all(
      imageBuffers.map(async (buffer) => {
        return await pdfDoc.embedPng(buffer);
      })
    );

    // Draw embedded images
    for (let i = 0; i < embeddedImages.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const x = margin + col * cellWidth;
      const y = height - margin - (row + 1) * cellHeight;

      page.drawImage(embeddedImages[i], {
        x,
        y,
        width: cellWidth,
        height: cellHeight
      });
    }
  }
}

module.exports = new PhotoToPdfService();