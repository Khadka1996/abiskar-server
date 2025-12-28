const User = require('../models/userModels');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const sendEmail = require('../utils/email');

// Utility to sign JWT tokens - Only one version exists now
const getJwtExpiration = () => {
  const DEFAULT_EXPIRATION = '1h';
  const envExpiration = process.env.JWT_EXPIRES_IN;
  
  if (!envExpiration) {
    console.warn('Using default JWT expiration');
    return DEFAULT_EXPIRATION;
  }

  if (!/^\d+[smhd]?$/.test(envExpiration)) {
    console.error('Invalid JWT_EXPIRES_IN format. Using default');
    return DEFAULT_EXPIRATION;
  }

  return envExpiration;
};

const signToken = (id, role, req) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  const fingerprint = crypto
    .createHash('sha256')
    .update(req.headers['user-agent'] + req.ip)
    .digest('hex');
  
  return jwt.sign(
    { id, role, fingerprint },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
};


const signRefreshToken = (id) => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }
  
  return jwt.sign(
    { id },
    process.env.JWT_REFRESH_SECRET, // Make sure this matches .env
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

// User Registration
exports.register = async (req, res, next) => {
  try {
    const newUser = await User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password
    });

    const token = signToken(newUser._id, newUser.role, req); // <-- FIXED HERE

    res.status(201).json({
      status: 'success',
      token,
      data: {
        user: newUser
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// User Login

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password!'
      });
    }

    // User verification
    const user = await User.findOne({ email })
      .select('+password +loginAttempts +active');

    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials'
      });
    }

    // Check password and active status
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid || !user.active) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid credentials'
      });
    }

    // Token generation (FIXED - added req parameter)
    const token = signToken(user._id, user.role, req);
    const refreshToken = signRefreshToken(user._id);

    // Cookie configuration
   const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', 
  sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax', 
  domain: process.env.NODE_ENV === 'production' ? '.everest.com' : undefined, 
  path: '/',
  maxAge: 3600000 // 1 hour
};

res.cookie('token', token, cookieOptions);
res.cookie('refreshToken', {
  ...cookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

    // Security cleanup
    user.password = undefined;
    user.loginAttempts = undefined;
    user.active = undefined;

    // Final response
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      }
    });

  } catch (err) {
    console.error('Error in login:', err);
    res.status(500).json({
      status: 'error',
      message: process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'Authentication system error'
    });
  }
};


// Protect routes middleware (already in authMiddleware.js)
// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    // 1. More secure user fetching
    const user = await User.findById(req.user.id)
      .select('-__v -password -passwordChangedAt') 
      .lean();

    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // 2. Standardized response format
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role
          // Only expose necessary fields
        }
      }
    });

  } catch (err) {
    // 3. Better error handling
    console.error(`Profile fetch error: ${err.message}`);
    res.status(500).json({
      status: 'error',
      message: process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'Failed to fetch profile'
    });
  }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        username: req.body.username,
        email: req.body.email
      },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Delete (deactivate) account
exports.deactivateAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { active: false });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Change password
exports.changePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');

    if (!(await user.comparePassword(req.body.currentPassword, user.password))) {
      return res.status(401).json({
        status: 'fail',
        message: 'Your current password is wrong'
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    const token = signToken(user._id, user.role);

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Forgot password
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'There is no user with that email address'
      });
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const resetURL = `${req.protocol}://${req.get('host')}/api/users/resetPassword/${resetToken}`;

    const message = `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    res.status(500).json({
      status: 'fail',
      message: 'There was an error sending the email. Try again later!'
    });
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'fail',
        message: 'Token is invalid or has expired'
      });
    }

    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const token = signToken(user._id, user.role);

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Admin: Get all users
exports.getAllUsers = async (req, res, next) => {
  try {
    // Parse query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const total = await User.countDocuments();
    
    // Get paginated results
    const users = await User.find()
      .skip(skip)
      .limit(limit)
      .select('-__v -password'); // Exclude sensitive fields

    res.status(200).json({
      status: 'success',
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit
      },
      data: {
        users
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Admin: Get single user
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Admin: Change user role
exports.changeUserRole = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// Admin: Delete user
exports.deleteUser = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { active: false });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        status: 'fail',
        message: 'No refresh token provided'
      });
    }

    const decoded = await promisify(jwt.verify)(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: 'fail',
        message: 'User no longer exists'
      });
    }

    const newToken = signToken(currentUser._id, currentUser.role);

    res.status(200).json({
      status: 'success',
      token: newToken
    });
  } catch (err) {
    res.status(401).json({
      status: 'fail',
      message: 'Invalid refresh token'
    });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-__v -password -passwordChangedAt');

    if (!user) {
      return res.status(404).json({
        status: 'fail',
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Failed to fetch user data'
    });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort('-createdAt');
    res.status(200).json({
      status: 'success',
      data: { logs }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch audit logs'
    });
  }
};

exports.getPendingModerationItems = async (req, res) => {
  try {
    const items = await Moderation.find({ status: 'pending' });
    res.json({ status: 'success', data: items });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
exports.approveContent = async (req, res) => {
  try {
    const item = await Moderation.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ status: 'fail', message: 'Item not found' });
    }

    item.status = 'approved';
    await item.save();

    res.status(200).json({ status: 'success', data: item });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
