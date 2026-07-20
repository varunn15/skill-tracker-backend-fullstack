const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_access_key_123456';

/**
 * Protect routes - Authentication Middleware
 */
const protect = (req, res, next) => {
  let token = null;

  // 1. Check Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. Fallback to access token cookie
  else if (req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split('; ').map(c => {
        const [key, ...v] = c.split('=');
        return [key, v.join('=')];
      })
    );
    token = cookies.accessToken;
  }

  // Handle case when token is missing
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Missing token',
      message: 'Access denied. No authentication token provided.'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach user payload to request
    req.user = decoded;
    return next();
  } catch (error) {
    console.error('JWT Verification Error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Expired token',
        message: 'Your authentication token has expired. Please log in again.'
      });
    }

    return res.status(403).json({
      success: false,
      error: 'Invalid token',
      message: 'Authentication token is invalid or malformed.'
    });
  }
};

/**
 * Role-based Authorization Middleware (Bonus)
 * @param {...string} allowedRoles - List of roles allowed to access
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Missing authentication',
        message: 'You must be logged in to access this resource.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized role',
        message: `Your role (${req.user.role}) is not authorized to access this resource.`
      });
    }

    return next();
  };
};

module.exports = {
  protect,
  authorize
};
