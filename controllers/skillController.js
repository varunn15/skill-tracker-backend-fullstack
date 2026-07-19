const Skill = require('../models/Skill');
const SkillRegistry = require('../models/SkillRegistry');
const { generateSkillId } = require('../utils/skillNormalizer');

const DEFAULT_USER = 'default-user';

// ➕ CREATE skill
const addSkill = async (req, res, next) => {
  try {
    const { skillId, level, category, experience } = req.body;

    if (!skillId) {
      return res.status(400).json({ error: 'Skill ID is required' });
    }

    if (!level || level < 1 || level > 10) {
      return res.status(400).json({ error: 'Level must be between 1 and 10' });
    }

    const registrySkill = await SkillRegistry.findOne({ skillId });
    if (!registrySkill) {
      return res.status(400).json({ 
        error: 'Skill not found. Please select from suggestions.' 
      });
    }

    const existingSkill = await Skill.findOne({
      user: DEFAULT_USER,
      skillId: skillId
    });

    if (existingSkill) {
      return res.status(400).json({ 
        error: 'You already have this skill!' 
      });
    }

    const skill = new Skill({
      user: DEFAULT_USER,
      skillId: skillId,
      skillName: registrySkill.name,
      level: level,
      category: category || registrySkill.category || 'Other',
      experience: experience || 'learned'
    });

    const savedSkill = await skill.save();

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
    const { level, category, experience } = req.body;

    const skill = await Skill.findOne({ 
      _id: req.params.id, 
      user: DEFAULT_USER 
    });

    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    skill.level = level || skill.level;
    skill.category = category || skill.category;
    skill.experience = experience || skill.experience;

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

// 📊 Get skill analytics - ✅ ADD THIS FUNCTION
const getSkillAnalytics = async (req, res, next) => {
  try {
    const userId = DEFAULT_USER;

    const totalSkills = await Skill.countDocuments({ user: userId });

    const levelDistribution = await Skill.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const categoryDistribution = await Skill.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const avgLevel = await Skill.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, avg: { $avg: '$level' } } }
    ]);

    res.json({
      totalSkills,
      levelDistribution,
      categoryDistribution,
      averageLevel: avgLevel.length > 0 ? Math.round(avgLevel[0].avg * 10) / 10 : 0
    });

  } catch (error) {
    console.error('Analytics error:', error);
    next(error);
  }
};

module.exports = {
  addSkill,
  getSkills,
  updateSkill,
  deleteSkill,
  getSkillAnalytics // ✅ Now this exists!
};