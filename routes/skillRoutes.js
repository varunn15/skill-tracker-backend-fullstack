const express = require('express');
const router = express.Router();
const {
  addSkill,
  getSkills,
  updateSkill,
  deleteSkill,
  getSkillAnalytics
} = require('../controllers/skillController');

// All routes are public (no auth yet)
router.post('/', addSkill);
router.get('/', getSkills);
router.get('/analytics', getSkillAnalytics);
router.put('/:id', updateSkill);
router.delete('/:id', deleteSkill);

module.exports = router;