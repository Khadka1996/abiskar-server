// middlewares/serviceValidation.js
const Joi = require('joi');
const mongoose = require('mongoose');

const validateRequest = (req, res, next, schema) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }
  next();
};

exports.validateServiceCreate = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required().min(3).max(50),
    description: Joi.string().required().min(10).max(500),
    contactMessage: Joi.string().required().min(10).max(200),
    icon: Joi.string().required().valid(
'FaLaptop', 'FaTabletAlt', 'FaGlobe', 'FaChrome', 'FaStore', 'FaBoxOpen', 'FaShippingFast', 'FaMoneyBillWave',
'FaEdit', 'FaKeyboard', 'FaFileAlt', 'FaBlog',
'FaLock', 'FaShieldAlt', 'FaUserLock',
'FaBrain',
'FaComments', 'FaEnvelope', 'FaPhoneAlt', 'FaVideo',
'FaMedal', 'FaCertificate', 'FaRocket', 'FaLightbulb', 'FaMagic',
'FaCogs', 'FaToolbox', 'FaPuzzlePiece', 'FaChartBar', 'FaChartPie',
'FaSearchDollar', 'FaAd', 'FaHashtag', 'FaPalette', 'FaImage', 'FaPhotoVideo',
'FaDesktop', 'FaMobileAlt', 'FaBullhorn', 'FaPaintBrush',
'FaCode', 'FaServer', 'FaDatabase', 'FaChartLine', 'FaShoppingCart',
'FaPlus', 'FaTrash', 'FaPencil', 'FaSearch', 'FaSpinner'

    ),
    features: Joi.array().items(Joi.string().min(3).max(50)).min(1).required()
  });

  validateRequest(req, res, next, schema);
};

exports.validateServiceUpdate = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(50),
    description: Joi.string().min(10).max(500),
    contactMessage: Joi.string().min(10).max(200),
    icon: Joi.string().valid(
      'FaDesktop', 'FaMobileAlt', 'FaBullhorn', 
      'FaEdit', 'FaPaintBrush', 'FaCode',
      'FaServer', 'FaDatabase', 'FaChartLine', 'FaShoppingCart'
    ),
    features: Joi.array().items(Joi.string().min(3).max(50)).min(1),
    isActive: Joi.boolean()
  }).min(1);

  validateRequest(req, res, next, schema);
};

exports.validateServiceIdParam = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid service ID'
    });
  }
  next();
};

exports.validateServiceSlugParam = (req, res, next) => {
  if (!/^[a-z0-9-]+$/.test(req.params.slug)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid service slug'
    });
  }
  next();
};