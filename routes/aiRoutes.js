const express = require('express');
const router = express.Router();
const { 
  getAIInsights, 
  getCareerReadiness
} = require('../controllers/openRouterController');

// ✅ TEST ROUTE - Remove after debugging
router.get('/test', (req, res) => {
  res.json({ message: '✅ AI routes are working!' });
});

router.post('/insights', getAIInsights);
router.post('/readiness', getCareerReadiness);

module.exports = router;