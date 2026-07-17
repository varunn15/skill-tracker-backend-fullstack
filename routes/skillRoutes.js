const express = require('express');
const router = express.Router();
const {
  addSkill,
  getSkills,
  updateSkill,
  deleteSkill,
  getSkillAnalytics
} = require('../controllers/skillController');

// Public routes (no auth needed for now)
router.post('/', addSkill);
router.get('/', getSkills);
router.get('/analytics', getSkillAnalytics);
router.put('/:id', updateSkill);
router.delete('/:id', deleteSkill);

module.exports = router;