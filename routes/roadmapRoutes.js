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

// ✅ Test
router.get('/test', testRoadmap);

module.exports = router;