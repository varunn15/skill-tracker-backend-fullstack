const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// @desc    Get AI insights (Fallback version without Gemini)
// @route   POST /api/ai/insights
// @access  Public
const getAIInsights = async (req, res, next) => {
  try {
    const { role } = req.body;

    // Get user's skills
    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.json({
        insight: '🚀 Start adding your skills to get personalized insights!',
        suggestedSkills: ['React', 'Node.js', 'Python', 'Docker'],
        missingSkills: [],
        careerReadiness: null
      });
    }

    // Generate insights from skills
    const insight = generateInsight(skills);
    const suggested = generateSuggestions(skills);
    const missing = generateMissingSkills(skills, role);

    res.json({
      insight,
      suggestedSkills: suggested,
      missingSkills: missing,
      careerReadiness: role ? generateReadiness(skills, role) : null
    });

  } catch (error) {
    console.error('AI Insights Error:', error);
    next(error);
  }
};

// @desc    Get career readiness
// @route   POST /api/ai/readiness
// @access  Public
const getCareerReadiness = async (req, res, next) => {
  try {
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const skills = await Skill.find({ user: DEFAULT_USER });
    const readiness = generateReadiness(skills, role);
    
    res.json(readiness);
  } catch (error) {
    console.error('Career Readiness Error:', error);
    next(error);
  }
};

// ===== Helper Functions =====

const generateInsight = (skills) => {
  const total = skills.length;
  const avgLevel = skills.reduce((sum, s) => sum + s.level, 0) / total;
  
  // Count categories
  const categories = {};
  skills.forEach(s => {
    const cat = s.category || 'Other';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  let strongest = '';
  let maxCount = 0;
  Object.entries(categories).forEach(([cat, count]) => {
    if (count > maxCount) { maxCount = count; strongest = cat; }
  });

  if (total === 1) {
    return `You have ${total} skill: ${skills[0].skillName}. Great start! Add more to build your profile. 🚀`;
  }

  if (total < 3) {
    return `You have ${total} skills. Keep adding more to build a strong profile! 💪`;
  }

  if (avgLevel >= 8) {
    return `⭐ You're an expert! Your strongest area is ${strongest || 'skills'}. Consider mentoring others.`;
  }

  if (avgLevel >= 5) {
    return `🚀 You're building solid expertise in ${strongest || 'your skills'}. Keep pushing forward!`;
  }

  return `🌱 You're on the right track with ${total} skills. Consistency is key! Keep learning and growing.`;
};

const generateSuggestions = (skills) => {
  const existingSkills = skills.map(s => s.skillName.toLowerCase());
  
  const allSuggestions = [
    { name: 'React', category: 'Frontend' },
    { name: 'Node.js', category: 'Backend' },
    { name: 'Python', category: 'Backend' },
    { name: 'Docker', category: 'DevOps' },
    { name: 'AWS', category: 'DevOps' },
    { name: 'TypeScript', category: 'Frontend' },
    { name: 'MongoDB', category: 'Database' },
    { name: 'PostgreSQL', category: 'Database' },
    { name: 'Git', category: 'Other' },
    { name: 'Express.js', category: 'Backend' },
  ];

  const suggested = allSuggestions.filter(s => 
    !existingSkills.some(existing => 
      existing.includes(s.name.toLowerCase()) || 
      s.name.toLowerCase().includes(existing)
    )
  );

  return suggested.slice(0, 5);
};

const generateMissingSkills = (skills, role) => {
  const existingSkills = skills.map(s => s.skillName.toLowerCase());
  
  const roleSkills = {
    'frontend': ['React', 'Vue.js', 'Angular', 'TypeScript', 'CSS', 'HTML', 'JavaScript'],
    'backend': ['Node.js', 'Python', 'Java', 'Express.js', 'Django', 'Spring Boot', 'PostgreSQL'],
    'fullstack': ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
    'devops': ['Docker', 'Kubernetes', 'AWS', 'Terraform', 'Jenkins', 'Linux', 'CI/CD'],
    'data': ['Python', 'SQL', 'Pandas', 'NumPy', 'Tableau', 'Power BI'],
    'mobile': ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Firebase'],
  };

  // Find matching role skills
  let missing = [];
  const roleKey = role?.toLowerCase() || '';
  
  for (const [key, skillsList] of Object.entries(roleSkills)) {
    if (roleKey.includes(key)) {
      missing = skillsList.filter(s => 
        !existingSkills.some(existing => 
          existing.includes(s.toLowerCase()) || 
          s.toLowerCase().includes(existing)
        )
      );
      break;
    }
  }

  // Default missing skills if no role matched
  if (missing.length === 0) {
    missing = ['System Design', 'Testing', 'Performance Optimization'];
  }

  return missing.slice(0, 5);
};

const generateReadiness = (skills, role) => {
  const totalSkills = skills.length;
  const avgLevel = skills.reduce((sum, s) => sum + s.level, 0) / totalSkills || 0;
  
  // Calculate score based on skills count and level
  const score = Math.min(Math.round((totalSkills * 5 + avgLevel * 5)), 95);
  
  const strengths = skills
    .filter(s => s.level >= 7)
    .map(s => s.skillName)
    .slice(0, 3);

  const weaknesses = skills
    .filter(s => s.level < 4)
    .map(s => s.skillName)
    .slice(0, 3);

  return {
    score: Math.max(score, 10),
    strengths: strengths.length > 0 ? strengths : ['You have skills to build on'],
    weaknesses: weaknesses.length > 0 ? weaknesses : ['No major weaknesses identified'],
    recommendations: [
      totalSkills < 5 ? 'Add more skills to your portfolio' : 'Keep building projects',
      avgLevel < 6 ? 'Focus on deepening your skills' : 'Consider sharing your knowledge',
      'Build a portfolio project to showcase your skills'
    ]
  };
};

module.exports = {
  getAIInsights,
  getCareerReadiness
};