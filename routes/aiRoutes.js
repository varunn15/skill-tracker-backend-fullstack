const express = require('express');
const router = express.Router();
const { getAIInsights, getCareerReadiness } = require('../controllers/aiController');

// ✅ These routes must match what frontend is calling
router.post('/insights', getAIInsights);
router.post('/readiness', getCareerReadiness);
module.exports = router;