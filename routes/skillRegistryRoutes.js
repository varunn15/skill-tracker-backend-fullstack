const express = require('express');
const router = express.Router();
const {
  searchSkills,
  getSuggestions,
  createSkillInRegistry,
  getRegistrySkills
} = require('../controllers/skillRegistryController');

// Public routes (no auth needed for now)
router.get('/search', searchSkills);
router.get('/suggestions', getSuggestions);
router.get('/registry', getRegistrySkills);
router.post('/registry', createSkillInRegistry);

module.exports = router;