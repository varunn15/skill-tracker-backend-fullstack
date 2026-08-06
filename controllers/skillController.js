const Skill = require('../models/Skill');
const SkillRegistry = require('../models/SkillRegistry');
const { generateSkillId } = require('../utils/skillNormalizer');

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
      user: req.user.id,
      skillId: skillId
    });

    if (existingSkill) {
      return res.status(400).json({ 
        error: 'You already have this skill!' 
      });
    }

    const skill = new Skill({
      user: req.user.id,
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
    const skills = await Skill.find({ user: req.user.id })
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
      user: req.user.id 
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
      user: req.user.id 
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

// ============================================================
// 📊 GET SKILL ANALYTICS - MongoDB Aggregation Pipeline
// ============================================================
const getSkillAnalytics = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // ✅ Aggregation Pipeline
    const [analytics] = await Skill.aggregate([
      // Step 1: Match only this user's skills
      { $match: { user: userId, isActive: true } },
      
      // Step 2: Group by category for distribution
      {
        $facet: {
          // 1️⃣ Total count and average level
          overview: [
            {
              $group: {
                _id: null,
                totalSkills: { $sum: 1 },
                averageLevel: { $avg: '$level' },
                maxLevel: { $max: '$level' },
                minLevel: { $min: '$level' }
              }
            }
          ],
          
          // 2️⃣ Category distribution
          categoryDistribution: [
            {
              $group: {
                _id: '$category',
                count: { $sum: 1 },
                averageLevel: { $avg: '$level' }
              }
            },
            { $sort: { count: -1 } }
          ],
          
          // 3️⃣ Level distribution (Beginner: 1-3, Intermediate: 4-7, Advanced: 8-10)
          levelDistribution: [
            {
              $group: {
                _id: {
                  $switch: {
                    branches: [
                      { case: { $lte: ['$level', 3] }, then: 'beginner' },
                      { case: { $lte: ['$level', 7] }, then: 'intermediate' },
                      { case: { $gte: ['$level', 8] }, then: 'advanced' }
                    ],
                    default: 'unknown'
                  }
                },
                count: { $sum: 1 },
                skills: { $push: '$skillName' }
              }
            },
            { $sort: { _id: 1 } }
          ],
          
          // 4️⃣ Skills added over time (last 30 days grouped by day)
          timeline: [
            {
              $match: {
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
              }
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                count: { $sum: 1 },
                skills: { $push: '$skillName' }
              }
            },
            { $sort: { _id: 1 } }
          ],
          
          // 5️⃣ Experience type distribution
          experienceDistribution: [
            {
              $group: {
                _id: '$experience',
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    // ✅ Format response with fallback for all categories
    const result = {
      totalSkills: analytics?.overview?.[0]?.totalSkills || 0,
      averageLevel: Math.round((analytics?.overview?.[0]?.averageLevel || 0) * 10) / 10,
      maxLevel: analytics?.overview?.[0]?.maxLevel || 0,
      minLevel: analytics?.overview?.[0]?.minLevel || 0,
      
      // Category distribution (ensure all categories exist)
      categoryDistribution: {
        Frontend: 0,
        Backend: 0,
        DevOps: 0,
        Database: 0,
        Other: 0,
        ...Object.fromEntries(
          (analytics?.categoryDistribution || []).map(item => [item._id, item.count])
        )
      },
      
      // Level distribution
      levelDistribution: {
        beginner: 0,
        intermediate: 0,
        advanced: 0,
        ...Object.fromEntries(
          (analytics?.levelDistribution || []).map(item => [item._id, item.count])
        )
      },
      
      // Timeline (last 30 days)
      timeline: analytics?.timeline || [],
      
      // Experience distribution
      experienceDistribution: {
        learned: 0,
        practiced: 0,
        project: 0,
        ...Object.fromEntries(
          (analytics?.experienceDistribution || []).map(item => [item._id, item.count])
        )
      }
    };

    res.json({
      success: true,
      data: result,
      _meta: {
        computedAt: new Date().toISOString(),
        source: 'aggregation',
        userId: userId
      }
    });

  } catch (error) {
    console.error('❌ Skill Analytics Error:', error.message);
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