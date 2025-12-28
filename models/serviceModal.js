// models/Service.js
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true,
    unique: true
  },
  slug: {
    type: String,
    required: [false, 'Service slug is required'],
    trim: true,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Service description is required']
  },
  contactMessage: {
    type: String,
    required: [true, 'Contact message is required']
  },
  icon: {
    type: String,
    required: [true, 'Icon is required'],
    enum: {
      values: [
        // Technology
        'FaDesktop', 'FaServer', 'FaDatabase', 'FaCode', 
        'FaMicrochip', 'FaRobot', 'FaNetworkWired', 'FaCloud',
        
        // Mobile/Web
        'FaMobileAlt', 'FaTabletAlt', 'FaGlobe', 'FaBrowser', 'FaChrome',
        
        // Design/Creative
        'FaPaintBrush', 'FaPalette', 'FaImage', 'FaPhotoVideo', 'FaVectorSquare',
        
        // Marketing
        'FaBullhorn', 'FaMegaphone', 'FaChartLine', 'FaChartBar', 'FaChartPie',
        'FaSearchDollar', 'FaAd', 'FaHashtag',
        
        // E-commerce
        'FaShoppingCart', 'FaStore', 'FaBoxOpen', 'FaShippingFast', 'FaMoneyBillWave',
        
        // Content
        'FaEdit', 'FaPenFancy', 'FaKeyboard', 'FaFileAlt', 'FaBlog',
        
        // Security
        'FaLock', 'FaShieldAlt', 'FaFingerprint', 'FaUserLock',
        
        // AI/Data
        'FaBrain', 'FaRobot', 'FaChartNetwork', 'FaDatabase',
        
        // Communication
        'FaComments', 'FaEnvelope', 'FaPhoneAlt', 'FaVideo', 'FaVoicemail',
        
        // Specialized
        'FaMedal', 'FaCertificate', 'FaRocket', 'FaLightbulb', 'FaMagic',
        'FaCogs', 'FaToolbox', 'FaPuzzlePiece'
      ],
      message: 'Please select a valid icon from Font Awesome collection'
    }
  },
  features: {
    type: [String],
    required: [true, 'At least one feature is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create slug from name before saving
serviceSchema.pre('save', function(next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
  }
  next();
});

module.exports = mongoose.model('Service', serviceSchema);