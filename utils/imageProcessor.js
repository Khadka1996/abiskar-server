const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');

async function processImage(imagePath, options = {}) {
  // First resize with sharp for performance
  const resizedBuffer = await sharp(imagePath)
    .resize({
      width: Math.round(options.width),
      height: Math.round(options.height),
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .toBuffer();

  // Then convert to PDF-lib compatible format
  const image = await loadImage(resizedBuffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  
  return {
    width: image.width,
    height: image.height,
    drawOnPage: (page, options) => {
      page.drawImage(canvas, options);
    }
  };
}

module.exports = { processImage };