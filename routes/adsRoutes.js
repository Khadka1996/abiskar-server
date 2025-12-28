const express = require('express');
const router = express.Router();
const adsController = require('../controllers/adsController');
const { validateAdvertisement } = require('../middlewares/adsMiddleware');

// Create a new advertisement
router.post('/', validateAdvertisement, adsController.createAdvertisement);

// Get all advertisements
router.get('/', adsController.getAllAdvertisements);

// Get advertisement by ID
router.get('/:id', adsController.getAdvertisementById);

// Update advertisement
router.put('/:id', validateAdvertisement, adsController.updateAdvertisement);

// Delete advertisement
router.delete('/:id', adsController.deleteAdvertisement);

module.exports = router;
