const express = require('express');
const router = express.Router();
const { register, login, logout, getMe } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { authLimiter, registerLimiter } = require('../middleware/rateLimiter');

// ✅ Public auth routes with rate limiting
router.post('/register', registerLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

// ✅ Profile route
router.get('/me', protect, getMe);

// Protected example route (Accessible to any logged-in user)
router.get('/protected', protect, (req, res) => {
  return res.json({
    success: true,
    message: 'Welcome to the protected zone! You successfully authenticated using JWT.',
    user: req.user
  });
});

// Admin-only route (Accessible only to users with the 'admin' role)
router.get('/admin-only', protect, authorize('admin'), (req, res) => {
  return res.json({
    success: true,
    message: 'Welcome Admin! You are authorized to access this highly sensitive section.',
    adminUser: req.user
  });
});

module.exports = router;