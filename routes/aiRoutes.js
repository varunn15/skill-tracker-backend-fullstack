const express = require('express');
const router = express.Router();
const { register, login, refresh, logout, getMe } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);

// Profile route
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
