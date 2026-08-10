const express = require('express');
const router = express.Router();
const { 
  getAIInsights, 
  getCareerReadiness
} = require('../controllers/openRouterController');
const { protect } = require('../middleware/authMiddleware');
const cacheMiddleware = require('../middleware/cacheMiddleware');
const { aiLimiter } = require('../middleware/rateLimiter');

// ✅ TEST ROUTE
router.get('/test', (req, res) => {
  res.json({ message: '✅ AI routes are working!' });
});

// ✅ Protect user AI endpoints
router.use(protect);

// ✅ Apply AI rate limiter to AI routes (10 per hour)
router.post('/insights', aiLimiter, cacheMiddleware('insights', 3600), getAIInsights);
router.post('/readiness', aiLimiter, cacheMiddleware('readiness', 3600), getCareerReadiness);

module.exports = router;