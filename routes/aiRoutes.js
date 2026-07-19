const express = require('express');
const router = express.Router();
const { 
  getAIInsights, 
  getCareerReadiness
} = require('../controllers/openRouterController');

// ✅ Only these two routes
router.post('/insights', getAIInsights);
router.post('/readiness', getCareerReadiness);

module.exports = router;