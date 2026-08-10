const rateLimit = require('express-rate-limit');

// ============================================================
// 1. AI ROUTES LIMITER - Strict (10 requests per hour)
// ============================================================
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many AI requests. Please wait an hour and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  // ✅ FIX: Remove custom keyGenerator - use default (IP based)
  // keyGenerator: (req) => req.user?.id || req.ip, // ❌ REMOVE THIS
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many AI requests. Please wait an hour and try again.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// ============================================================
// 2. AUTH ROUTES LIMITER - Strict for login/register
// ============================================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many login attempts. Please wait 15 minutes and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'Too many login attempts. Please wait 15 minutes and try again.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// ============================================================
// 3. GENERAL API LIMITER
// ============================================================
const generalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: {
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// ============================================================
// 4. REGISTRATION LIMITER
// ============================================================
const registerLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3,
  message: {
    success: false,
    error: 'Rate limit exceeded',
    message: 'Too many registration attempts. Please try again tomorrow.'
  },
  standardHeaders: true,
  legacyHeaders: false
  // ✅ Uses default IP-based key generator
});

module.exports = {
  aiLimiter,
  authLimiter,
  generalLimiter,
  registerLimiter
};