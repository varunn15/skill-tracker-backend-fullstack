const express = require('express');
const router = express.Router();
const { generateRoadmap } = require('../controllers/roadmapController');

// ✅ Support both GET and POST
router.post('/generate', generateRoadmap);
router.get('/generate', generateRoadmap);

module.exports = router;