const express = require('express');
const router = express.Router();
const { 
  getAIInsights, 
  getCareerReadiness
} = require('../controllers/openRouterController');

// ✅ SUPPORT BOTH GET AND POST
router.get('/insights', getAIInsights);
router.post('/insights', getAIInsights);

router.get('/readiness', getCareerReadiness);
router.post('/readiness', getCareerReadiness);

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: '✅ AI routes are working!',
    endpoints: {
      insights: 'GET/POST /ai/insights?role=Frontend',
      readiness: 'GET/POST /ai/readiness?role=Frontend'
    }
  });
});

module.exports = router;