const Skill = require('../models/Skill');
const SkillRegistry = require('../models/SkillRegistry');
const { generateSkillId } = require('../utils/skillNormalizer');
const Joi = require('joi');

// Default user ID for now (will be replaced with real auth later)
const DEFAULT_USER = 'default-user';

const skillSchemaValidation = Joi.object({
  skillId: Joi.string().required().messages({
    'string.empty': 'Skill is required',
    'any.required': 'Skill is required'
  }),
  level: Joi.number().min(1).max(10).required(),
  category: Joi.string().valid('Frontend', 'Backend', 'DevOps', 'Database', 'Other'),
  experience: Joi.string().valid('learned', 'practiced', 'project'),
  notes: Joi.string().allow('', null),
  projectLink: Joi.string().uri().allow('', null)
});

// ➕ CREATE skill with smart input
const addSkill = async (req, res, next) => {
  try {
    const { error } = skillSchemaValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { skillId, level, category, experience, notes, projectLink } = req.body;

    // ✅ Check if skill exists in registry
    const registrySkill = await SkillRegistry.findOne({ skillId });
    if (!registrySkill) {
      return res.status(400).json({ 
        error: 'Skill not found in registry. Please use the search to find or create a skill.' 
      });
    }

    // ✅ Check if user already has this skill
    const existingSkill = await Skill.findOne({
      user: DEFAULT_USER,
      skillId: skillId
    });

    if (existingSkill) {
      return res.status(400).json({ 
        error: 'You already have this skill. You can edit it instead.' 
      });
    }

    // ✅ Create user skill
    const skillData = {
      user: DEFAULT_USER,
      skillId: skillId,
      skillName: registrySkill.name,
      level: level || 5,
      category: category || registrySkill.category || 'Other',
      experience: experience || 'learned',
      notes: notes || '',
      projectLink: projectLink || ''
    };

    const skill = new Skill(skillData);
    const savedSkill = await skill.save();

    // ✅ Update popularity
    await SkillRegistry.findByIdAndUpdate(registrySkill._id, {
      $inc: { popularity: 1 }
    });

    res.status(201).json(savedSkill);

  } catch (err) {
    next(err);
  }
};

// 📥 GET all skills
const getSkills = async (req, res, next) => {
  try {
    const skills = await Skill.find({ user: DEFAULT_USER })
      .sort({ createdAt: -1 });
    
    res.json(skills);
  } catch (err) {
    next(err);
  }
};

// ✏️ UPDATE skill
const updateSkill = async (req, res, next) => {
  try {
    const { error } = skillSchemaValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // ✅ Find skill
    const skill = await Skill.findOne({ 
      _id: req.params.id, 
      user: DEFAULT_USER 
    });

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    const { skillId, level, category, experience, notes, projectLink } = req.body;

    // ✅ If skillId changed, verify new skill exists
    if (skillId && skillId !== skill.skillId) {
      const registrySkill = await SkillRegistry.findOne({ skillId });
      if (!registrySkill) {
        return res.status(400).json({ 
          error: 'Skill not found in registry' 
        });
      }
      
      // Check if user already has this skill
      const existingSkill = await Skill.findOne({
        user: DEFAULT_USER,
        skillId: skillId,
        _id: { $ne: req.params.id }
      });

      if (existingSkill) {
        return res.status(400).json({ 
          error: 'You already have this skill' 
        });
      }

      // Update skillId and name
      skill.skillId = skillId;
      skill.skillName = registrySkill.name;
    }

    // Update other fields
    skill.level = level || skill.level;
    skill.category = category || skill.category;
    skill.experience = experience || skill.experience;
    skill.notes = notes !== undefined ? notes : skill.notes;
    skill.projectLink = projectLink !== undefined ? projectLink : skill.projectLink;

    await skill.save();

    res.json(skill);

  } catch (err) {
    next(err);
  }
};

// ❌ DELETE skill
const deleteSkill = async (req, res, next) => {
  try {
    const skill = await Skill.findOne({ 
      _id: req.params.id, 
      user: DEFAULT_USER 
    });

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    await Skill.findByIdAndDelete(req.params.id);
    res.json({ message: 'Skill deleted successfully' });

  } catch (err) {
    next(err);
  }
};

// 📊 Get skill analytics
const getSkillAnalytics = async (req, res, next) => {
  try {
    const userId = DEFAULT_USER;

    // Total skills
    const totalSkills = await Skill.countDocuments({ user: userId });

    // Skills by level
    const levelDistribution = await Skill.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Skills by category
    const categoryDistribution = await Skill.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Skills by experience
    const experienceDistribution = await Skill.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$experience', count: { $sum: 1 } } }
    ]);

    // Average level
    const avgLevel = await Skill.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, avg: { $avg: '$level' } } }
    ]);

    res.json({
      totalSkills,
      levelDistribution,
      categoryDistribution,
      experienceDistribution,
      averageLevel: avgLevel.length > 0 ? avgLevel[0].avg : 0
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  addSkill,
  getSkills,
  updateSkill,
  deleteSkill,
  getSkillAnalytics
};