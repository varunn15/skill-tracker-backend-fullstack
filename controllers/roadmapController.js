const Skill = require('../models/Skill');
const SkillRegistry = require('../models/SkillRegistry');

const DEFAULT_USER = 'default-user';

// ============================================================
// 1. ROADMAP GENERATOR CONTROLLER
// ============================================================
const generateRoadmap = async (req, res) => {
  try {
    const { role, missingSkills, suggestedSkills } = req.body;

    if (!role) {
      return res.status(400).json({ 
        error: 'Role is required',
        _meta: { status: 'missing_role' }
      });
    }

    // Get user's skills
    const skills = await Skill.find({ user: DEFAULT_USER });
    
    // Get registry data for skill details
    const registrySkills = await SkillRegistry.find({
      name: { $in: [...missingSkills, ...suggestedSkills] }
    });

    // ✅ Generate phased roadmap
    const roadmap = generatePhasedRoadmap(role, missingSkills, suggestedSkills, registrySkills);

    res.json({
      roadmap,
      _meta: {
        role,
        missing_skills: missingSkills.length,
        suggested_skills: suggestedSkills.length,
        total_phases: roadmap.phases.length,
        estimated_weeks: roadmap.total_weeks,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Roadmap Error:', error.message);
    res.status(500).json({
      error: 'Failed to generate roadmap',
      _meta: { status: 'error', message: error.message }
    });
  }
};

// ============================================================
// 2. ROADMAP GENERATION LOGIC
// ============================================================
const generatePhasedRoadmap = (role, missingSkills, suggestedSkills, registrySkills) => {
  // Define skill difficulty mapping
  const skillDifficulty = {
    'javascript': 'beginner',
    'html': 'beginner',
    'css': 'beginner',
    'python': 'beginner',
    'react': 'intermediate',
    'vue': 'intermediate',
    'angular': 'intermediate',
    'node.js': 'intermediate',
    'express': 'intermediate',
    'mongodb': 'intermediate',
    'postgresql': 'intermediate',
    'docker': 'intermediate',
    'kubernetes': 'advanced',
    'aws': 'advanced',
    'typescript': 'intermediate',
    'graphql': 'advanced',
  };

  // Group skills by difficulty
  const groupedSkills = {
    beginner: [],
    intermediate: [],
    advanced: []
  };

  [...missingSkills, ...suggestedSkills].forEach(skill => {
    const lowerSkill = skill.toLowerCase();
    const difficulty = skillDifficulty[lowerSkill] || 
                       (lowerSkill.includes('advanced') ? 'advanced' : 'intermediate');
    groupedSkills[difficulty].push(skill);
  });

  // ✅ Build phases
  const phases = [];
  let weekCounter = 1;

  // Phase 1: Foundations (Beginner skills)
  if (groupedSkills.beginner.length > 0) {
    phases.push({
      id: 1,
      title: 'Foundations',
      description: `Master the core fundamentals of ${role}`,
      weeks: `${weekCounter}–${weekCounter + 1}`,
      goal: `Build a solid foundation in ${groupedSkills.beginner.join(', ')}`,
      skills: groupedSkills.beginner,
      tasks: generateTasks(groupedSkills.beginner, 'beginner'),
      projects: [`Build a simple project using ${groupedSkills.beginner.slice(0, 2).join(' and ')}`],
      estimated_hours: groupedSkills.beginner.length * 4,
      difficulty: 'Beginner'
    });
    weekCounter += 2;
  }

  // Phase 2: Core Skills (Intermediate skills)
  if (groupedSkills.intermediate.length > 0) {
    phases.push({
      id: 2,
      title: 'Core Skills',
      description: `Build practical skills for ${role}`,
      weeks: `${weekCounter}–${weekCounter + 1}`,
      goal: `Master essential ${role} skills`,
      skills: groupedSkills.intermediate,
      tasks: generateTasks(groupedSkills.intermediate, 'intermediate'),
      projects: [`Build a project using ${groupedSkills.intermediate.slice(0, 2).join(' and ')}`],
      estimated_hours: groupedSkills.intermediate.length * 6,
      difficulty: 'Intermediate'
    });
    weekCounter += 2;
  }

  // Phase 3: Advanced Skills
  if (groupedSkills.advanced.length > 0) {
    phases.push({
      id: 3,
      title: 'Advanced Skills',
      description: `Take your ${role} skills to the next level`,
      weeks: `${weekCounter}–${weekCounter + 1}`,
      goal: `Master advanced concepts`,
      skills: groupedSkills.advanced,
      tasks: generateTasks(groupedSkills.advanced, 'advanced'),
      projects: [`Build a production-ready app with ${groupedSkills.advanced.slice(0, 2).join(' and ')}`],
      estimated_hours: groupedSkills.advanced.length * 8,
      difficulty: 'Advanced'
    });
    weekCounter += 2;
  }

  // Phase 4: Integration & Polish
  phases.push({
    id: phases.length + 1,
    title: 'Integration & Polish',
    description: `Combine everything into a complete ${role} project`,
    weeks: `${weekCounter}–${weekCounter + 1}`,
    goal: `Build a full ${role} application from scratch`,
    skills: [...missingSkills, ...suggestedSkills],
    tasks: [
      'Plan your architecture and tech stack',
      'Build a complete full-stack application',
      'Write comprehensive tests',
      'Deploy to production',
      'Document your project'
    ],
    projects: [`Full ${role} Application with all technologies`],
    estimated_hours: 20,
    difficulty: 'Advanced'
  });

  // ✅ Calculate total estimated time
  const totalWeeks = phases.reduce((total, phase) => {
    const weeks = phase.weeks.split('–');
    return total + (parseInt(weeks[1]) - parseInt(weeks[0]) + 1);
  }, 0);

  return {
    role,
    title: `Learning Roadmap for ${role}`,
    total_weeks: totalWeeks,
    estimated_hours: phases.reduce((sum, p) => sum + p.estimated_hours, 0),
    phases
  };
};

// ============================================================
// 3. TASK GENERATOR
// ============================================================
const generateTasks = (skills, difficulty) => {
  const taskMap = {
    'beginner': [
      'Learn the fundamentals and syntax',
      'Build small practice projects',
      'Complete tutorials and documentation',
      'Solve beginner coding challenges'
    ],
    'intermediate': [
      'Build real-world projects',
      'Learn best practices and patterns',
      'Integrate with other technologies',
      'Handle error cases and edge cases'
    ],
    'advanced': [
      'Architect complex systems',
      'Implement advanced features',
      'Optimize performance and scalability',
      'Write comprehensive tests and documentation'
    ]
  };

  const baseTasks = taskMap[difficulty] || taskMap.intermediate;
  
  // Add skill-specific tasks
  const skillTasks = skills.map(skill => 
    `Build a project using ${skill}`
  );

  return [...baseTasks, ...skillTasks.slice(0, 2)];
};

module.exports = {
  generateRoadmap
};