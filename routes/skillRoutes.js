const express = require('express');
const router = express.Router();
const {
  addSkill,
  getSkills,
  updateSkill,
  deleteSkill,
  getSkillAnalytics // ✅ This must be here
} = require('../controllers/skillController');
const { protect } = require('../middleware/authMiddleware');

// Apply protection middleware to all personal skill routes
router.use(protect);

router.post('/', addSkill);
router.get('/', getSkills);
router.get('/analytics', getSkillAnalytics); // ✅ This route uses it
router.put('/:id', updateSkill);
router.delete('/:id', deleteSkill);

module.exports = router;