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

router.post('/generate', generateRoadmap);
router.get('/generate', generateRoadmap);
router.post('/save', saveRoadmap);
router.get('/', getRoadmap);
router.post('/toggle', toggleTask);
router.delete('/:id', deleteRoadmap);
router.get('/test', testRoadmap);

module.exports = router;