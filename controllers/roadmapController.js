const Roadmap = require('../models/Roadmap');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// TEST ROUTE
const testRoadmap = async (req, res) => {
  res.json({
    success: true,
    message: '✅ Roadmap routes are working!',
    endpoints: {
      get: 'GET /roadmap',
      save: 'POST /roadmap/save',
      generate: 'POST /roadmap/generate',
      toggle: 'POST /roadmap/toggle'
    }
  });
};

// ✅ Rest of your controller functions...
// (generateRoadmap, saveRoadmap, getRoadmap, toggleTask, deleteRoadmap)

module.exports = {
  generateRoadmap,
  saveRoadmap,
  getRoadmap,
  toggleTask,
  deleteRoadmap,
  testRoadmap
};