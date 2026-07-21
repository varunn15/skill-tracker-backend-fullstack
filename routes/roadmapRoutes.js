const express = require('express');
const router = express.Router();
const {
  generateRoadmap,
  saveRoadmap,
  getRoadmap,
  toggleTask,
  deleteRoadmap,
  testRoadmap
} = require('../controllers/roadmapController');
const { protect } = require('../middleware/authMiddleware');

// Public test route
router.get('/test', testRoadmap);

// Apply protection middleware to all other user roadmap routes
router.use(protect);

// ✅ Generate
router.post('/generate', generateRoadmap);
router.get('/generate', generateRoadmap);

// ✅ Save & Retrieve
router.post('/save', saveRoadmap);
router.get('/', getRoadmap);

// ✅ Update
router.post('/toggle', toggleTask);

// ✅ Delete
router.delete('/:id', deleteRoadmap);

module.exports = router;