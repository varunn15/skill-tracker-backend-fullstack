const express = require('express');
const router = express.Router();
const { 
  getAIInsights, 
  getCareerReadiness
} = require('../controllers/openRouterController');
const { protect } = require('../middleware/authMiddleware');
const cacheMiddleware = require('../middleware/cacheMiddleware');

// ✅ TEST ROUTE
router.get('/test', (req, res) => {
  res.json({ message: '✅ AI routes are working!' });
});

// ✅ Protect user AI endpoints
router.use(protect);

// ✅ Apply cache middleware to AI routes (TTL: 1 hour for quicker updates)
router.post('/insights', cacheMiddleware('insights', 3600), getAIInsights);
router.post('/readiness', cacheMiddleware('readiness', 3600), getCareerReadiness);

module.exports = router;