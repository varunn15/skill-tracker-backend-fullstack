const express = require('express');
const router = express.Router();
const {
  addSkill,
  getSkills,
  updateSkill,
  deleteSkill
} = require('../controllers/skillController');

router.post('/', addSkill);
router.get('/', getSkills);
router.put('/:id', updateSkill);
router.delete('/:id', deleteSkill);

module.exports = router;