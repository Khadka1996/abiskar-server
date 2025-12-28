const Advertisement = require('../models/adsModel');

// Create a new advertisement
exports.createAdvertisement = async (req, res) => {
  try {
    const { websiteLink, imagePath, position } = req.body;
    const advertisement = new Advertisement({ websiteLink, imagePath, position });
    await advertisement.save();
    res.status(201).json({ success: true, message: 'Advertisement created successfully', advertisement });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating advertisement', error: error.message });
  }
};

// Get all advertisements
exports.getAllAdvertisements = async (req, res) => {
  try {
    const advertisements = await Advertisement.find();
    res.status(200).json({ success: true, advertisements });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching advertisements', error: error.message });
  }
};

// Get advertisement by ID
exports.getAdvertisementById = async (req, res) => {
  try {
    const advertisement = await Advertisement.findById(req.params.id);
    if (!advertisement) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }
    res.status(200).json({ success: true, advertisement });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching advertisement', error: error.message });
  }
};

// Update advertisement
exports.updateAdvertisement = async (req, res) => {
  try {
    const { websiteLink, imagePath, position } = req.body;
    const advertisement = await Advertisement.findByIdAndUpdate(
      req.params.id,
      { websiteLink, imagePath, position },
      { new: true, runValidators: true }
    );
    if (!advertisement) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }
    res.status(200).json({ success: true, message: 'Advertisement updated successfully', advertisement });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating advertisement', error: error.message });
  }
};

// Delete advertisement
exports.deleteAdvertisement = async (req, res) => {
  try {
    const advertisement = await Advertisement.findByIdAndDelete(req.params.id);
    if (!advertisement) {
      return res.status(404).json({ success: false, message: 'Advertisement not found' });
    }
    res.status(200).json({ success: true, message: 'Advertisement deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting advertisement', error: error.message });
  }
};
