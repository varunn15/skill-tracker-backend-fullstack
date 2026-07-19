const express = require('express');
const router = express.Router();
const {
  addSkill,
  getSkills,
  updateSkill,
  deleteSkill,
  getSkillAnalytics // ✅ This must be here
} = require('../controllers/skillController');

router.post('/', addSkill);
router.get('/', getSkills);
router.get('/analytics', getSkillAnalytics); // ✅ This route uses it
router.put('/:id', updateSkill);
router.delete('/:id', deleteSkill);

module.exports = router;