const { v4: uuidv4 } = require('uuid');
const { Device } = require('../models/chatModel');
const useragent = require('useragent');
const sanitizeHtml = require('sanitize-html');
const validator = require('validator'); // For UUID validation

// Detect device type from User-Agent header
const detectDeviceType = (userAgent) => {
  if (!userAgent) {
    console.warn('User-Agent header missing, defaulting to unknown');
    return 'unknown';
  }
  try {
    const agent = useragent.parse(userAgent);
    if (agent.device.family === 'iPhone') return 'mobile';
    if (agent.device.family === 'iPad') return 'tablet';
    if (agent.os.family === 'Android') return 'mobile';
    return 'desktop';
  } catch (error) {
    console.warn('Invalid User-Agent header, defaulting to unknown:', error.message);
    return 'unknown';
  }
};

// Device middleware
const deviceMiddleware = async (req, res, next) => {
  try {
    console.log('Device middleware: Starting...', { url: req.originalUrl });

    // Validate or generate deviceId
    let deviceId = req.headers['device-id'];
    if (deviceId && !validator.isUUID(deviceId, 4)) {
      console.warn('Invalid device-id header:', deviceId);
      deviceId = uuidv4(); // Generate new ID if invalid
    } else if (!deviceId) {
      deviceId = uuidv4();
      console.log('No device-id provided, generated:', deviceId);
    }

    const deviceType = detectDeviceType(req.headers['user-agent']);
    console.log('Device ID:', deviceId, 'Type:', deviceType);

    // Find or create device
    const device = await Device.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          lastActive: new Date(),
          type: deviceType
        },
        $setOnInsert: {
          name: `Guest-${deviceId.slice(0, 4)}`
        }
      },
      {
        new: true,
        upsert: true,
        select: 'deviceId name type isBlocked', // Select only needed fields
        maxTimeMS: 5000 // 5-second timeout
      }
    );

    // Check if device is blocked
    if (device.isBlocked) {
      console.error('Device middleware: Blocked device', { deviceId });
      return res.status(403).json({ error: 'Your device is blocked from accessing this service' });
    }

    // Sanitize device name
    const sanitizedName = sanitizeHtml(device.name, {
      allowedTags: [],
      allowedAttributes: {}
    });

    // Attach device info to request
    req.deviceInfo = {
      id: device.deviceId,
      name: sanitizedName,
      type: device.type
    };

    // Set response headers
    res.set('Device-ID', device.deviceId);
    res.set('Device-Name', sanitizedName);

    // Set a cookie for deviceId persistence (optional)
    res.cookie('deviceId', device.deviceId, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    console.log('Device middleware: Completed', { device: req.deviceInfo });
    next();
  } catch (error) {
    console.error('Device middleware error:', error.message, { deviceId: req.headers['device-id'] });
    res.status(500).json({ error: `Failed to process device information: ${error.message}` });
  }
};

module.exports = deviceMiddleware;