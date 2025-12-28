const jwt = require("jsonwebtoken");
const User = require("../models/userModels");
const rateLimit = require("express-rate-limit");
const { createHash } = require("crypto");


// Enhanced security configuration
const SECURITY_CONFIG = {
  TOKEN_MIN_LENGTH: 100,
  SESSION_TIMEOUT: 60 * 60 * 1000, // 1 hour
  TOKEN_PREFIX: "Bearer ",
  REFRESH_TOKEN_COOKIE_NAME: "refreshToken",
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
  TOKEN_REFRESH_WINDOW: 5 * 60 * 1000, // 5 minutes before expiry
  TOKEN_BLACKLIST: new Set() // In-memory blacklist (for single process)
};

// Enhanced debug logger with security filtering
const debug = (message, data = {}) => {
  const filteredData = Object.entries(data).reduce((acc, [key, value]) => {
    acc[key] = key.toLowerCase().includes("token") ? "[REDACTED]" : value;
    return acc;
  }, {});
  console.log(`[AuthDebug][${new Date().toISOString()}] ${message}`, filteredData);
};

// Rate limiters for different scenarios
// const authLimiters = {
//   global: rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     keyGenerator: (req) => req.ip,
//     handler: (req, res) => {
//       debug("Rate limit exceeded", { ip: req.ip });
//       res.status(429).json({
//         status: 'fail',
//         code: "RATE_LIMITED",
//         message: "Too many requests, please try again later"
//       });
//     }
//   }),
//   login: rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 5,
//     keyGenerator: (req) => req.ip,
//     handler: (req, res) => {
//       debug("Login rate limit exceeded", { ip: req.ip });
//       res.status(429).json({
//         status: 'fail',
//         code: "LOGIN_RATE_LIMITED",
//         message: "Too many login attempts, try again later"
//       });
//     }
//   })
// };

// const authLimiters = {
  // global: (req, res, next) => next(), 
  // login: (req, res, next) => next()    
// };


// Token verification with client binding
const verifyToken = async (token, req) => {
  if (!token || token.length < SECURITY_CONFIG.TOKEN_MIN_LENGTH) {
    throw new Error("INVALID_TOKEN_FORMAT");
  }

  // Check in-memory blacklist
  const hashedToken = createHash('sha256').update(token).digest('hex');
  if (SECURITY_CONFIG.TOKEN_BLACKLIST.has(hashedToken)) {
    throw new Error("REVOKED_TOKEN");
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: false });
  
  // Verify client fingerprint
  const clientFingerprint = createHash('sha256')
    .update(req.headers['user-agent'] + req.ip)
    .digest('hex');
  
  if (decoded.fingerprint !== clientFingerprint) {
    throw new Error("INVALID_CLIENT_CONTEXT");
  }

  return decoded;
};

// Enhanced refresh token verification
const verifyRefreshToken = async (refreshToken, req) => {
  if (!refreshToken) throw new Error("MISSING_REFRESH_TOKEN");
  
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const hashedToken = createHash('sha256').update(refreshToken).digest('hex');
  
  const user = await User.findOne({ 
    _id: decoded.id,
    refreshToken: hashedToken,
    active: true
  }).select('_id email role username sessionVersion');
  
  if (!user) throw new Error("INVALID_REFRESH_TOKEN");
  
  // Check session version
  if (decoded.sessionVersion !== user.sessionVersion) {
    throw new Error("SESSION_REVOKED");
  }

  return {
    id: user._id,
    email: user.email,
    role: user.role,
    username: user.username,
    sessionVersion: user.sessionVersion
  };
};

// Generate tokens with client context
const generateTokenPair = (user, req) => {
  const clientFingerprint = createHash('sha256')
    .update(req.headers['user-agent'] + req.ip)
    .digest('hex');

  const token = jwt.sign(
    { 
      id: user.id, 
      role: user.role,
      fingerprint: clientFingerprint,
      sessionVersion: user.sessionVersion
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
  
  const refreshToken = jwt.sign(
    { 
      id: user.id,
      sessionVersion: user.sessionVersion
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  
  return { token, refreshToken };
};
// Main authentication middleware with debugging
const authMiddleware = async (req, res, next) => {
  
  try {
    console.debug('\n===== AUTH MIDDLEWARE START =====');
    console.debug('Request Headers:', JSON.stringify(req.headers, null, 2));
    console.debug('Request Cookies:', req.cookies);

    // 1. Token Extraction Debugging
    let token = null;
    
    // Check Authorization header
    if (req.headers.authorization) {
      console.debug('Authorization header exists');
      if (req.headers.authorization.startsWith(SECURITY_CONFIG.TOKEN_PREFIX)) {
        token = req.headers.authorization.slice(SECURITY_CONFIG.TOKEN_PREFIX.length);
        console.debug('Extracted token from Authorization header');
      } else {
        console.debug('Authorization header has invalid format');
      }
    }

    // Check cookies if no token from header
    if (!token && req.cookies) {
      console.debug('Checking cookies for token');
      token = req.cookies.token;
      if (token) {
        console.debug('Extracted token from cookies');
      } else {
        console.debug('No token found in cookies');
      }
    }

    if (!token) {
      console.debug('NO TOKEN FOUND IN REQUEST');
      return res.status(401).json({
        status: 'fail',
        code: "NO_TOKEN",
        message: "Authentication required"
      });
    }

    console.debug('Token found:', token.length > 50 ? 
      `${token.substring(0, 25)}...${token.substring(token.length - 25)}` : token);

    // 2. Token Verification Debugging
    try {
      console.debug('\n--- Verifying Token ---');
      const decoded = await verifyToken(token, req);
      console.debug('Decoded Token:', {
        id: decoded.id,
        role: decoded.role,
        iat: new Date(decoded.iat * 1000),
        exp: new Date(decoded.exp * 1000)
      });

      // Session timeout validation
      const sessionAge = Date.now() - (decoded.iat * 1000);
      console.debug(`Session age: ${sessionAge}ms (max ${SECURITY_CONFIG.SESSION_TIMEOUT}ms)`);
      
      if (sessionAge > SECURITY_CONFIG.SESSION_TIMEOUT) {
        console.debug('SESSION TIMEOUT REACHED');
        throw new Error("SESSION_TIMEOUT");
      }

      // Check if token needs refresh
      const expiresIn = (decoded.exp * 1000) - Date.now();
      console.debug(`Token expires in: ${expiresIn}ms (refresh window: ${SECURITY_CONFIG.TOKEN_REFRESH_WINDOW}ms)`);
      
      if (expiresIn < SECURITY_CONFIG.TOKEN_REFRESH_WINDOW) {
        console.debug('Token nearing expiry, attempting refresh');
        await attemptTokenRefresh(req, res, decoded);
      }

      // 3. User Verification Debugging
      console.debug('\n--- Verifying User ---');
      const user = await User.findOne({
        _id: decoded.id,
        active: true
      }).select('-password -__v -createdAt -updatedAt -refreshToken');

      if (!user) {
        console.debug('USER NOT FOUND OR INACTIVE');
        throw new Error("USER_INACTIVE");
      }

      console.debug('User verified:', {
        id: user._id,
        username: user.username,
        role: user.role
      });

      // Attach user to request
      req.user = {
        id: user._id,
        email: user.email,
        role: user.role,
        username: user.username,
        sessionIssued: new Date(decoded.iat * 1000),
        sessionVersion: decoded.sessionVersion
      };

      console.debug('\n===== AUTH SUCCESS =====');
      next();
    } catch (tokenError) {
      console.error('\n--- TOKEN VERIFICATION ERROR ---');
      console.error('Error:', tokenError.name, tokenError.message);
      console.error('Stack:', tokenError.stack);

      if (tokenError.name === 'TokenExpiredError') {
        console.debug('Handling expired token');
        await handleExpiredToken(req, res, next);
      } else {
        throw tokenError;
      }
    }
  } catch (error) {
    handleAuthError(error, req, res);
  }
};

// Handle token refresh flow with rotation
const attemptTokenRefresh = async (req, res, decoded) => {
  const refreshToken = req.cookies?.[SECURITY_CONFIG.REFRESH_TOKEN_COOKIE_NAME];
  if (!refreshToken) return;

  try {
    // 1. Verify the existing refresh token
    const userData = await verifyRefreshToken(refreshToken, req);

    // 2. Generate new tokens
    const { token: newToken, refreshToken: newRefreshToken } = generateTokenPair(userData, req);

    // 3. Hash the new refresh token for DB storage
    const newHashedToken = createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');

    // 4. Update user record (atomic operation)
    await User.findByIdAndUpdate(
      userData.id,
      {
        refreshToken: newHashedToken, // Store new token
        $inc: { sessionVersion: 1 }   // Invalidate all previous sessions
      }
    );

    // 5. Set secure cookies
    const baseCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    };

    res.cookie('token', newToken, {
      ...baseCookieOptions,
      maxAge: 3600000 // 1 hour
    });

    res.cookie(SECURITY_CONFIG.REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, {
      ...baseCookieOptions,
      maxAge: SECURITY_CONFIG.REFRESH_TOKEN_EXPIRY // 7 days
    });

    // 6. (Optional) In-memory blacklist of old refresh token
    const oldTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    SECURITY_CONFIG.TOKEN_BLACKLIST.add(oldTokenHash);

    debug("Token rotated successfully", { userId: userData.id });

  } catch (error) {
    debug("Token refresh failed", { 
      error: error.message,
      userId: decoded?.id 
    });

    // Critical security response - force logout if token is invalid
    if (error.message === "INVALID_REFRESH_TOKEN" || 
        error.message === "SESSION_REVOKED") {
      res.clearCookie('token');
      res.clearCookie(SECURITY_CONFIG.REFRESH_TOKEN_COOKIE_NAME);
    }
  }
};

// Handle expired token scenario
const handleExpiredToken = async (req, res, next) => {
  const refreshToken = req.cookies?.[SECURITY_CONFIG.REFRESH_TOKEN_COOKIE_NAME];
  if (!refreshToken) throw new Error("TOKEN_EXPIRED");

  try {
    const userData = await verifyRefreshToken(refreshToken, req);
    const { token, refreshToken: newRefreshToken } = generateTokenPair(userData, req);

    // Update refresh token and session version
    await User.findByIdAndUpdate(userData.id, {
      refreshToken: createHash('sha256').update(newRefreshToken).digest('hex'),
      $inc: { sessionVersion: 1 }
    });

    // Set new tokens as secure cookies
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });

    res.cookie(SECURITY_CONFIG.REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SECURITY_CONFIG.REFRESH_TOKEN_EXPIRY
    });

    // Set user context
    req.user = userData;
    debug("Token rotation successful", { userId: userData.id });
    next();
  } catch (error) {
    debug("Token rotation failed", { error: error.message });
    throw new Error("TOKEN_EXPIRED");
  }
};

// Enhanced error handling
const handleAuthError = (error, req, res) => {
  const errorMap = {
    TokenExpiredError: {
      code: "TOKEN_EXPIRED",
      message: "Session expired - please login again",
      status: 401
    },
    JsonWebTokenError: {
      code: "INVALID_TOKEN",
      message: "Invalid credentials",
      status: 401
    },
    NotBeforeError: {
      code: "TOKEN_INACTIVE",
      message: "Token not yet valid",
      status: 401
    },
    INVALID_TOKEN_FORMAT: {
      code: "INVALID_TOKEN",
      message: "Malformed authentication token",
      status: 400
    },
    SESSION_TIMEOUT: {
      code: "SESSION_TIMEOUT",
      message: "Session expired due to inactivity",
      status: 401
    },
    USER_INACTIVE: {
      code: "USER_INACTIVE",
      message: "Account deactivated",
      status: 403
    },
    REVOKED_TOKEN: {
      code: "REVOKED_TOKEN",
      message: "Session terminated",
      status: 401
    },
    MISSING_REFRESH_TOKEN: {
      code: "MISSING_REFRESH_TOKEN",
      message: "Refresh token required",
      status: 401
    },
    INVALID_REFRESH_TOKEN: {
      code: "INVALID_REFRESH_TOKEN",
      message: "Invalid refresh token",
      status: 401
    },
    INVALID_CLIENT_CONTEXT: {
      code: "SESSION_HIJACK",
      message: "Suspicious activity detected",
      status: 401
    },
    SESSION_REVOKED: {
      code: "SESSION_REVOKED",
      message: "Session invalidated by new login",
      status: 401
    }
  };

  const errorInfo = errorMap[error.name] || errorMap[error.message] || {
    code: "AUTH_ERROR",
    message: "Authentication system error",
    status: 500
  };

  // Log suspicious activities
  if (errorInfo.code === "SESSION_HIJACK") {
    debug("Possible hijack attempt", {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      attemptedUser: req.user?.id
    });
  }

  res.status(errorInfo.status).json({
    status: 'fail',
    code: errorInfo.code,
    message: errorInfo.message
  });
};

// Token refresh endpoint handler
const handleTokenRefresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.[SECURITY_CONFIG.REFRESH_TOKEN_COOKIE_NAME] || 
                       req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        status: 'fail',
        code: "MISSING_REFRESH_TOKEN",
        message: "Refresh token required"
      });
    }

    const userData = await verifyRefreshToken(refreshToken, req);
    const { token, refreshToken: newRefreshToken } = generateTokenPair(userData, req);

    // Update refresh token and session version
    await User.findByIdAndUpdate(userData.id, {
      refreshToken: createHash('sha256').update(newRefreshToken).digest('hex'),
      $inc: { sessionVersion: 1 }
    });

    // Set secure cookies
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });

    res.cookie(SECURITY_CONFIG.REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SECURITY_CONFIG.REFRESH_TOKEN_EXPIRY
    });

    res.json({
      status: 'success',
      data: {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
      }
    });
  } catch (error) {
    handleAuthError(error, req, res);
  }
};

// Role authorization with hierarchy
const authorizeRoles = (...roles) => {
  const roleHierarchy = {
    admin: ['admin', 'moderator', 'user'],
    moderator: ['moderator', 'user'],
    user: ['user']
  };

  return (req, res, next) => {
    try {
      if (!req.user?.role) throw new Error("MISSING_ROLE");
      
      const effectiveRoles = roleHierarchy[req.user.role] || [];
      const hasAccess = roles.some(role => effectiveRoles.includes(role));

      if (!hasAccess) {
        debug("Role hierarchy violation", {
          required: roles,
          effective: effectiveRoles,
          userId: req.user.id
        });
        throw new Error("INSUFFICIENT_PRIVILEGES");
      }

      debug("Role access granted", {
        userId: req.user.id,
        requiredRoles: roles,
        effectiveRoles
      });
      next();
    } catch (error) {
      res.status(403).json({
        status: 'fail',
        code: "FORBIDDEN",
        message: "Insufficient permissions for this operation"
      });
    }
  };
};

// Secure logout handler
const handleLogout = async (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7) || req.cookies?.token;
    
    if (token) {
      const hashedToken = createHash('sha256').update(token).digest('hex');
      SECURITY_CONFIG.TOKEN_BLACKLIST.add(hashedToken);
    }

    // Force refresh token invalidation
    await User.findByIdAndUpdate(req.user.id, {
      refreshToken: null, // 🔥 Critical change
      $inc: { sessionVersion: 1 }
    });

    res.clearCookie('token');
    res.clearCookie('refreshToken');
    res.status(200).json({ status: 'success' });
  } catch (error) {
    handleAuthError(error, req, res);
  }
};



module.exports = {
  authMiddleware,
  authorizeRoles,
  handleTokenRefresh,
  handleLogout,
  securityConfig: SECURITY_CONFIG
};