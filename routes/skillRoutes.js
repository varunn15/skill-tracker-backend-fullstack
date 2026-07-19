const express = require('express');
const router = express.Router();
const {
  addSkill,
  getSkills,
  updateSkill,
  deleteSkill,
  getSkillAnalytics
} = require('../controllers/skillController');

// ✅ These routes work at /skills
router.post('/', addSkill);
router.get('/', getSkills);
router.get('/analytics', getSkillAnalytics);
router.put('/:id', updateSkill);
router.delete('/:id', deleteSkill);

module.exports = router;