const express = require('express');
const router = express.Router();
const { getAIInsights, getCareerReadiness } = require('../controllers/aiController');

router.post('/insights', getAIInsights);
router.post('/readiness', getCareerReadiness);

module.exports = router;