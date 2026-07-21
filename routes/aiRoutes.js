const express = require('express');
const router = express.Router();
const { 
  getAIInsights, 
  getCareerReadiness
} = require('../controllers/openRouterController');
const { protect } = require('../middleware/authMiddleware');

// ✅ TEST ROUTE - Remove after debugging
router.get('/test', (req, res) => {
  res.json({ message: '✅ AI routes are working!' });
});

// Protect user AI endpoints
router.use(protect);

router.post('/insights', getAIInsights);
router.post('/readiness', getCareerReadiness);

module.exports = router;