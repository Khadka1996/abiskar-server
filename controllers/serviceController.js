// controllers/serviceController.js
const Service = require('../models/serviceModal');

exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.find({ isActive: true });
    res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

exports.getServiceBySlug = async (req, res) => {
  try {
    const service = await Service.findOne({ slug: req.params.slug, isActive: true });
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }
    res.status(200).json({
      success: true,
      data: service
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

exports.createService = async (req, res) => {
  try {
    const service = new Service(req.body);
    await service.save();
    res.status(201).json({
      success: true,
      data: service
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

exports.updateService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }
    res.status(200).json({
      success: true,
      data: service
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

exports.getAvailableIcons = async (req, res) => {
  try {
    const icons = [
      { value: 'FaDesktop', label: 'Desktop' },
      { value: 'FaMobileAlt', label: 'Mobile' },
      { value: 'FaBullhorn', label: 'Marketing' },
      { value: 'FaEdit', label: 'Editing' },
      { value: 'FaPaintBrush', label: 'Design' },
      { value: 'FaCode', label: 'Coding' },
      { value: 'FaServer', label: 'Server' },
      { value: 'FaDatabase', label: 'Database' },
      { value: 'FaChartLine', label: 'Analytics' },
      { value: 'FaShoppingCart', label: 'E-commerce' }
    ];
    res.status(200).json({
      success: true,
      data: icons
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

exports.approveService = async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    );
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }
    res.status(200).json({
      success: true,
      data: service
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

exports.getServiceStatistics = async (req, res) => {
  try {
    const stats = await Service.aggregate([
      {
        $group: {
          _id: '$isApproved',
          count: { $sum: 1 }
        }
      }
    ]);
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};