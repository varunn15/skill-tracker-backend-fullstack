const express = require('express');
const router = express.Router();
const { 
  getAIInsights, 
  getCareerReadiness
} = require('../controllers/openRouterController');

// ✅ POST routes (not GET)
router.post('/insights', getAIInsights);
router.post('/readiness', getCareerReadiness);

// ✅ Add a test GET route to verify it's mounted
router.get('/test', (req, res) => {
  res.json({ message: '✅ AI routes are working!' });
});

module.exports = router;