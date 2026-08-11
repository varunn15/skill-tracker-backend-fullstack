const rateLimit = require('express-rate-limit');

// Skip rate limiting in normal tests, but allow dedicated rate-limit tests.
const isTest = (
  process.env.NODE_ENV === 'test' &&
  process.env.RATE_LIMIT_TEST !== 'true'
) || process.env.SKIP_RATE_LIMIT === 'true';

// ============================================================
// 1. AI ROUTES LIMITER
// ============================================================
const aiLimiter = isTest 
  ? (req, res, next) => next() 
  : rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 10,
      message: {
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many AI requests. Please wait an hour and try again.'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
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
// 2. AUTH ROUTES LIMITER
// ============================================================
const authLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
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
// 3. REGISTRATION LIMITER
// ============================================================
const registerLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 24 * 60 * 60 * 1000,
      max: 3,
      message: {
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many registration attempts. Please try again tomorrow.'
      },
      standardHeaders: true,
      legacyHeaders: false
    });

// ============================================================
// 4. GENERAL API LIMITER
// ============================================================
const generalLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000,
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

module.exports = {
  aiLimiter,
  authLimiter,
  generalLimiter,
  registerLimiter
};