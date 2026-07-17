const SkillRegistry = require('../models/SkillRegistry');
const { 
  normalizeSkillName, 
  generateSkillId, 
  areSkillsSimilar 
} = require('../utils/skillNormalizer');

// @desc    Search skills with autocomplete
// @route   GET /api/skills/search?q=react
// @access  Public (for now)
const searchSkills = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 1) {
      return res.json([]);
    }

    const normalizedQuery = normalizeSkillName(q);
    
    // Search by name or aliases with text search
    let results = await SkillRegistry.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { aliases: { $regex: q, $options: 'i' } }
      ]
    }).limit(10);

    // If no results, try fuzzy matching
    if (results.length === 0) {
      const allSkills = await SkillRegistry.find().limit(50);
      
      results = allSkills.filter(skill => {
        return areSkillsSimilar(q, skill.name) ||
          skill.aliases.some(alias => areSkillsSimilar(q, alias));
      });
    }

    res.json(results);

  } catch (error) {
    next(error);
  }
};

// @desc    Get skill suggestions with fuzzy matching
// @route   GET /api/skills/suggestions?q=node
// @access  Public
const getSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 1) {
      return res.json([]);
    }

    const normalizedQuery = normalizeSkillName(q);
    
    // Find exact matches
    let exactMatches = await SkillRegistry.find({
      $or: [
        { skillId: { $regex: `^${normalizedQuery}`, $options: 'i' } },
        { name: { $regex: `^${q}`, $options: 'i' } }
      ]
    }).limit(5);

    // Find fuzzy matches
    const allSkills = await SkillRegistry.find().limit(20);
    const fuzzyMatches = allSkills.filter(skill => {
      if (exactMatches.some(s => s.skillId === skill.skillId)) return false;
      
      const skillNameNormalized = normalizeSkillName(skill.name);
      return skillNameNormalized.includes(normalizedQuery) ||
        skill.aliases.some(alias => 
          normalizeSkillName(alias).includes(normalizedQuery)
        );
    });

    // Combine results
    const suggestions = [...exactMatches, ...fuzzyMatches.slice(0, 5)];
    
    // Add "Did you mean?" suggestions if no exact match
    if (suggestions.length === 0) {
      const didYouMean = allSkills.filter(skill => {
        return areSkillsSimilar(q, skill.name);
      }).slice(0, 3);
      
      if (didYouMean.length > 0) {
        return res.json({ 
          suggestions: [],
          didYouMean: didYouMean 
        });
      }
    }

    res.json({ 
      suggestions,
      didYouMean: []
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Create a new skill in registry
// @route   POST /api/skills/registry
// @access  Public
const createSkillInRegistry = async (req, res, next) => {
  try {
    const { name, category, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Skill name is required' });
    }

    const skillId = generateSkillId(name);
    
    // Check if skill already exists
    const existingSkill = await SkillRegistry.findOne({ 
      $or: [
        { skillId },
        { name: { $regex: `^${name}$`, $options: 'i' } }
      ]
    });

    if (existingSkill) {
      return res.status(400).json({ 
        message: 'Skill already exists in registry',
        skill: existingSkill
      });
    }

    const newSkill = await SkillRegistry.create({
      skillId,
      name,
      category: category || 'Other',
      description: description || '',
      aliases: [skillId, name.toLowerCase()]
    });

    res.status(201).json({
      message: 'Skill created successfully',
      skill: newSkill
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get all skills from registry
// @route   GET /api/skills/registry
// @access  Public
const getRegistrySkills = async (req, res, next) => {
  try {
    const skills = await SkillRegistry.find()
      .sort({ name: 1 })
      .limit(100);
    
    res.json(skills);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchSkills,
  getSuggestions,
  createSkillInRegistry,
  getRegistrySkills
};