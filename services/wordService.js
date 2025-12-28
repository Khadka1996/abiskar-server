// services/wordService.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class WordService {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp/converted');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async convertToWord({ inputPath, originalname, format = 'docx' }) {
    const outputName = `${Date.now()}-${path.parse(originalname).name}.${format}`;
    const outputPath = path.join(this.tempDir, outputName);

    try {
      // Verify input file exists
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      // Clean up any existing output
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      // Conversion command with timeout
      const command = `timeout 30 libreoffice --headless --convert-to ${format} "${inputPath}" --outdir "${this.tempDir}"`;

      console.log(`Executing: ${command}`);
      const { stdout, stderr } = await execPromise(command);

      if (stderr) {
        console.error('LibreOffice stderr:', stderr);
      }

      // Verify output was created
      if (!fs.existsSync(outputPath)) {
        throw new Error(`Conversion failed. LibreOffice output: ${stdout || stderr}`);
      }

      return outputPath;
    } catch (error) {
      // Clean up on failure
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      throw error;
    }
  }
}

module.exports = new WordService();