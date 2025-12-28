const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const http = require('http');
const { logger } = require('./utils/logger.util');
const { cleanDirectory } = require('./utils/fileUtils');
require('dotenv').config();
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

// Import middlewares
const { uploadBlogImage, handleUploadErrors } = require('./middlewares/blogMiddleware');
const errorHandler = require('./middlewares/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Enhanced Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Security middlewares
app.use(mongoSanitize());
app.use(cookieParser());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB connection
const dbURI = process.env.MONGO_URI;
if (!dbURI) {
  logger.error('MONGO_URI is not set in .env file');
  process.exit(1);
}

mongoose.connect(dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 60000,
    maxPoolSize: 50,
    wtimeoutMS: 25000,
  })
  .then(() => logger.info('MongoDB connected successfully'))
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to DB');
});
mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error:', err);
});
mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from DB');
});

// Directory setup
['./temp/uploads', './temp/processing'].forEach((dir) => {
  if (fs.existsSync(dir)) {
    cleanDirectory(dir);
    logger.info(`Cleaned directory: ${dir}`);
  } else {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created directory: ${dir}`);
  }
});

const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info(`Created directory: ${uploadsDir}`);
}

app.use('/uploads',
  (req, res, next) => {
    logger.info(`Static file request: ${req.originalUrl}`);
    next();
  },
  express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.jpg') || filePath.endsWith('.png') || filePath.endsWith('.webp')) {
        res.setHeader('Content-Type', 'image/' + filePath.split('.').pop());
      }
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      }
    },
  })
);

app.post('/uploads',
  uploadBlogImage,
  handleUploadErrors,
  async (req, res) => {
    try {
      if (!req.file) {
        logger.warn('No file uploaded');
        return res.status(400).json({
          success: false,
          message: 'No file uploaded or upload failed',
        });
      }

      logger.info(`File uploaded successfully: ${req.file.filename}`);
      res.json({
        success: true,
        filePath: `/uploads/${req.file.filename}`,
        fileName: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    } catch (err) {
      logger.error('Upload processing error:', err);
      if (req.file) {
        try {
          await unlinkAsync(req.file.path);
        } catch (cleanupErr) {
          logger.error('File cleanup error:', cleanupErr);
        }
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

// Routes
app.use('/api/ads', require('./routes/adsRoutes'));
app.use('/api/blogs', require('./routes/blogRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/pdf', require('./routes/pdf.routes'));
app.use('/api/word', require('./routes/wordRoutes'));
app.use('/api/photo-to-pdf', require('./routes/photoToPdfRoutes'));
app.use('/api/pdf-to-jpg', require('./routes/pdfToJpgRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/client', require('./routes/clientsRoutes'));
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'UP',
    timestamp: new Date().toISOString(),
    dbState: mongoose.connection.readyState,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development',
  };
  res.status(200).json(healthStatus);
});

app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = app;