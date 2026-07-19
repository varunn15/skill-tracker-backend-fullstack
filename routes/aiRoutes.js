const express = require('express');
const router = express.Router();
const { 
  getAIInsights, 
  getCareerReadiness,
  getModels 
} = require('../controllers/openRouterController'); // 👈 Changed to openRouterController

router.post('/insights', getAIInsights);
router.post('/readiness', getCareerReadiness);
router.get('/models', getModels); // 👈 New endpoint

module.exports = router;