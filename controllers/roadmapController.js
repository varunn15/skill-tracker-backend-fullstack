const Roadmap = require('../models/Roadmap');
const Skill = require('../models/Skill');
const SkillRegistry = require('../models/SkillRegistry');

const DEFAULT_USER = 'default-user';

// ============================================================
// 1. SANITIZATION FUNCTIONS
// ============================================================
const cleanArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  
  const cleaned = [...new Set(arr)]
    .filter(item => 
      item &&
      typeof item === 'string' &&
      item.length < 60 &&
      item.length > 2 &&
      !item.toLowerCase().includes('experience') &&
      !item.toLowerCase().includes('ability') &&
      !item.toLowerCase().includes('lack') &&
      !item.toLowerCase().includes('limited') &&
      !item.toLowerCase().includes('knowledge') &&
      !item.toLowerCase().includes('understanding') &&
      !item.toLowerCase().includes('familiar')
    )
    .map(item => item.trim());
  
  return cleaned.slice(0, 6);
};

// ============================================================
// 2. DYNAMIC FALLBACK ROADMAP - ROLE SPECIFIC
// ============================================================
const generateFallbackRoadmap = (role) => {
  const roleLower = role.toLowerCase();
  
  const isFrontend = roleLower.includes('frontend') || roleLower.includes('ui') || roleLower.includes('react') || roleLower.includes('vue') || roleLower.includes('angular');
  const isBackend = roleLower.includes('backend') || roleLower.includes('api') || roleLower.includes('node') || roleLower.includes('python') || roleLower.includes('java');
  const isFullstack = roleLower.includes('fullstack') || roleLower.includes('full-stack') || (isFrontend && isBackend);
  const isDevops = roleLower.includes('devops') || roleLower.includes('cloud') || roleLower.includes('aws') || roleLower.includes('docker');
  const isData = roleLower.includes('data') || roleLower.includes('analytics') || roleLower.includes('ml') || roleLower.includes('ai');
  const isMobile = roleLower.includes('mobile') || roleLower.includes('ios') || roleLower.includes('android') || roleLower.includes('react native');
  
  let levels = [];
  
  if (isFullstack) {
    levels = [
      {
        title: 'Frontend Foundations',
        duration: '2-3 weeks',
        phase: 'Phase 1',
        skills: ['HTML', 'CSS', 'JavaScript', 'React'],
        tasks: [
          { title: 'Build a responsive portfolio website' },
          { title: 'Learn React components and state' },
          { title: 'Build a todo app with React' }
        ],
        projects: ['Portfolio Website']
      },
      {
        title: 'Backend & APIs',
        duration: '2-3 weeks',
        phase: 'Phase 2',
        skills: ['Node.js', 'Express', 'MongoDB', 'REST APIs'],
        tasks: [
          { title: 'Build a REST API with Express' },
          { title: 'Connect to MongoDB database' },
          { title: 'Implement CRUD operations' }
        ],
        projects: ['REST API Service']
      },
      {
        title: 'Full Stack Integration',
        duration: '2-3 weeks',
        phase: 'Phase 3',
        skills: ['React', 'Node.js', 'JWT Auth', 'Deployment'],
        tasks: [
          { title: 'Connect frontend to backend' },
          { title: 'Add JWT authentication' },
          { title: 'Deploy full-stack app to cloud' }
        ],
        projects: ['Full Stack Application']
      }
    ];
  } else if (isFrontend) {
    levels = [
      {
        title: 'HTML & CSS Mastery',
        duration: '1-2 weeks',
        phase: 'Phase 1',
        skills: ['HTML', 'CSS', 'Flexbox', 'Grid', 'Responsive Design'],
        tasks: [
          { title: 'Build a responsive landing page' },
          { title: 'Learn CSS Flexbox and Grid' },
          { title: 'Create a mobile-first design' }
        ],
        projects: ['Responsive Website']
      },
      {
        title: 'JavaScript & React',
        duration: '2-3 weeks',
        phase: 'Phase 2',
        skills: ['JavaScript', 'React', 'State Management', 'Hooks'],
        tasks: [
          { title: 'Build interactive React components' },
          { title: 'Learn useState and useEffect hooks' },
          { title: 'Implement state management' }
        ],
        projects: ['React Application']
      },
      {
        title: 'Advanced Frontend',
        duration: '1-2 weeks',
        phase: 'Phase 3',
        skills: ['TypeScript', 'Next.js', 'Tailwind CSS', 'Performance'],
        tasks: [
          { title: 'Convert project to TypeScript' },
          { title: 'Build with Next.js framework' },
          { title: 'Optimize performance and SEO' }
        ],
        projects: ['Next.js Website']
      }
    ];
  } else if (isBackend) {
    levels = [
      {
        title: 'Backend Fundamentals',
        duration: '2-3 weeks',
        phase: 'Phase 1',
        skills: ['Node.js', 'Express', 'REST APIs'],
        tasks: [
          { title: 'Build a basic Express server' },
          { title: 'Create REST API endpoints' },
          { title: 'Implement error handling' }
        ],
        projects: ['Basic API Service']
      },
      {
        title: 'Database & Authentication',
        duration: '2-3 weeks',
        phase: 'Phase 2',
        skills: ['MongoDB', 'JWT Auth', 'PostgreSQL'],
        tasks: [
          { title: 'Connect to MongoDB' },
          { title: 'Build authentication system' },
          { title: 'Implement role-based access' }
        ],
        projects: ['User Management API']
      },
      {
        title: 'Advanced Backend',
        duration: '1-2 weeks',
        phase: 'Phase 3',
        skills: ['Docker', 'AWS', 'System Design', 'Caching'],
        tasks: [
          { title: 'Containerize application with Docker' },
          { title: 'Deploy to cloud (AWS)' },
          { title: 'Design scalable system architecture' }
        ],
        projects: ['Production-Ready API']
      }
    ];
  } else if (isDevops) {
    levels = [
      {
        title: 'Linux & Scripting',
        duration: '1-2 weeks',
        phase: 'Phase 1',
        skills: ['Linux', 'Bash', 'Networking', 'Security'],
        tasks: [
          { title: 'Master Linux command line' },
          { title: 'Write Bash scripts' },
          { title: 'Configure networking basics' }
        ],
        projects: ['Linux Server Setup']
      },
      {
        title: 'Containerization & Orchestration',
        duration: '2-3 weeks',
        phase: 'Phase 2',
        skills: ['Docker', 'Kubernetes', 'Container Orchestration'],
        tasks: [
          { title: 'Containerize applications with Docker' },
          { title: 'Learn Kubernetes basics' },
          { title: 'Deploy with Kubernetes' }
        ],
        projects: ['Containerized App']
      },
      {
        title: 'Cloud & CI/CD',
        duration: '2-3 weeks',
        phase: 'Phase 3',
        skills: ['AWS', 'Terraform', 'Jenkins', 'CI/CD'],
        tasks: [
          { title: 'Deploy to AWS' },
          { title: 'Automate with Terraform' },
          { title: 'Build CI/CD pipeline with Jenkins' }
        ],
        projects: ['Cloud Infrastructure']
      }
    ];
  } else if (isData) {
    levels = [
      {
        title: 'Python & Data Analysis',
        duration: '2-3 weeks',
        phase: 'Phase 1',
        skills: ['Python', 'Pandas', 'NumPy', 'Data Visualization'],
        tasks: [
          { title: 'Learn Python for data analysis' },
          { title: 'Master Pandas and NumPy' },
          { title: 'Create data visualizations' }
        ],
        projects: ['Data Analysis Project']
      },
      {
        title: 'Machine Learning',
        duration: '2-3 weeks',
        phase: 'Phase 2',
        skills: ['Scikit-learn', 'Machine Learning', 'Model Evaluation'],
        tasks: [
          { title: 'Build ML models with Scikit-learn' },
          { title: 'Evaluate model performance' },
          { title: 'Optimize hyperparameters' }
        ],
        projects: ['ML Model']
      },
      {
        title: 'Big Data & Production',
        duration: '2-3 weeks',
        phase: 'Phase 3',
        skills: ['Spark', 'SQL', 'Tableau', 'AWS'],
        tasks: [
          { title: 'Work with Big Data using Spark' },
          { title: 'Advanced SQL queries' },
          { title: 'Deploy to AWS' }
        ],
        projects: ['Data Pipeline']
      }
    ];
  } else if (isMobile) {
    levels = [
      {
        title: 'Mobile Foundations',
        duration: '2-3 weeks',
        phase: 'Phase 1',
        skills: ['React Native', 'Components', 'Navigation'],
        tasks: [
          { title: 'Build React Native app' },
          { title: 'Learn navigation and routing' },
          { title: 'Create reusable components' }
        ],
        projects: ['Mobile App']
      },
      {
        title: 'Native Features',
        duration: '2-3 weeks',
        phase: 'Phase 2',
        skills: ['Native APIs', 'Firebase', 'State Management'],
        tasks: [
          { title: 'Integrate native device features' },
          { title: 'Connect to Firebase' },
          { title: 'Implement state management' }
        ],
        projects: ['Native Mobile App']
      },
      {
        title: 'Deployment & Optimization',
        duration: '1-2 weeks',
        phase: 'Phase 3',
        skills: ['App Store', 'Play Store', 'Performance'],
        tasks: [
          { title: 'Optimize app performance' },
          { title: 'Prepare for App Store submission' },
          { title: 'Deploy to Play Store' }
        ],
        projects: ['Published App']
      }
    ];
  } else {
    // ✅ Generic fallback for any role
    levels = [
      {
        title: 'Core Skills Development',
        duration: '2-3 weeks',
        phase: 'Phase 1',
        skills: ['Core Concepts', 'Problem Solving', 'Programming Basics'],
        tasks: [
          { title: 'Learn programming fundamentals' },
          { title: 'Build problem-solving skills' },
          { title: 'Complete coding challenges' }
        ],
        projects: ['Portfolio Projects']
      },
      {
        title: 'Specialization',
        duration: '2-3 weeks',
        phase: 'Phase 2',
        skills: ['Specialized Skills', 'Framework', 'Tools'],
        tasks: [
          { title: 'Learn role-specific skills' },
          { title: 'Build real-world projects' },
          { title: 'Master essential tools' }
        ],
        projects: ['Specialized Projects']
      },
      {
        title: 'Professional Readiness',
        duration: '1-2 weeks',
        phase: 'Phase 3',
        skills: ['Portfolio', 'Interview Prep', 'Networking'],
        tasks: [
          { title: 'Build professional portfolio' },
          { title: 'Prepare for technical interviews' },
          { title: 'Build professional network' }
        ],
        projects: ['Professional Portfolio']
      }
    ];
  }
  
  return {
    role,
    levels: levels.map(level => ({
      ...level,
      skills: cleanArray(level.skills),
      tasks: level.tasks.map(t => ({ title: t.title, completed: false })),
      projects: cleanArray(level.projects)
    }))
  };
};

// ============================================================
// 3. UPDATE SKILL LEVEL ON TASK COMPLETION
// ============================================================
const updateSkillLevel = async (userId, skillName, increment = 1) => {
  try {
    const registrySkill = await SkillRegistry.findOne({
      name: { $regex: new RegExp(`^${skillName}$`, 'i') }
    });

    let skillId = skillName.toLowerCase().replace(/[^a-z0-9]/g, '');
    let displayName = skillName;

    if (registrySkill) {
      skillId = registrySkill.skillId;
      displayName = registrySkill.name;
    }

    let userSkill = await Skill.findOne({
      user: userId,
      skillId: skillId
    });

    if (userSkill) {
      userSkill.level = Math.min(userSkill.level + increment, 10);
      userSkill.skillName = displayName;
      await userSkill.save();
      console.log(`✅ Updated ${displayName} to level ${userSkill.level}`);
      return userSkill;
    }

    const newSkill = new Skill({
      user: userId,
      skillId: skillId,
      skillName: displayName,
      level: 1,
      category: registrySkill?.category || 'Other',
      experience: 'practiced',
      isActive: true
    });
    await newSkill.save();
    console.log(`✅ Created new skill: ${displayName} at level 1`);
    return newSkill;

  } catch (error) {
    console.error('❌ Error updating skill level:', error.message);
    return null;
  }
};

// ============================================================
// 4. CALL OPENROUTER
// ============================================================
const callOpenRouter = async (messages) => {
  const { OpenAI } = require('openai');
  
  const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    timeout: 120000,
    defaultHeaders: {
      'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5000',
      'X-Title': 'Skill Tracker App',
    }
  });

  const models = [
    'mistralai/mixtral-8x7b-instruct:free',
    'google/gemma-2-9b-it:free',
    'meta-llama/llama-3.2-3b-instruct:free',
  ];

  for (const model of models) {
    try {
      const response = await openrouter.chat.completions.create({
        model,
        messages,
        max_tokens: 800,
        temperature: 0.7,
      });
      return response;
    } catch (error) {
      console.error(`Model ${model} failed:`, error.message);
    }
  }
  throw new Error('All models failed');
};

// ============================================================
// 5. GENERATE ROADMAP - UPDATED
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

    const skills = await Skill.find({ user: DEFAULT_USER });
    const existingSkills = skills.map(s => s.skillName);

    const allNeededSkills = [...new Set([
      ...(missingSkills || []),
      ...(suggestedSkills || [])
    ])].filter(s => s && s.length > 0);

    if (allNeededSkills.length === 0) {
      const fallback = generateFallbackRoadmap(role);
      return res.json({
        roadmap: fallback,
        _meta: { 
          status: 'fallback', 
          message: 'No skills provided, using role-specific fallback',
          role: role
        }
      });
    }

    const prompt = `You are an expert career coach. Generate a clean, structured learning roadmap for: ${role}

User already knows: ${existingSkills.join(', ') || 'None yet'}

Skills they need to learn: ${allNeededSkills.join(', ')}

IMPORTANT: Generate a roadmap that is SPECIFIC to ${role}. 
- For Frontend: Focus on HTML, CSS, JavaScript, React/Vue/Angular, TypeScript, Tailwind
- For Backend: Focus on Node.js/Python/Java, Express/Django/Spring, databases, APIs
- For Fullstack: Combine frontend and backend skills
- For DevOps: Focus on Docker, Kubernetes, AWS, CI/CD, Linux
- For Data: Focus on Python, Pandas, SQL, Machine Learning, Tableau
- For Mobile: Focus on React Native/Flutter/Swift/Kotlin

STRICT RULES:
- skills = ONLY technologies or concepts (e.g. React, Node.js, REST APIs)
- tasks = ACTIONABLE steps (e.g. Build authentication system, Create REST endpoints)
- projects = CONCRETE portfolio projects (e.g. E-commerce website, Blog API)
- DO NOT include weaknesses, explanations, or "improve" statements
- DO NOT repeat items across phases
- Keep items SHORT (max 6 words each)

Return ONLY JSON with this EXACT structure:
{
  "levels": [
    {
      "title": "Foundations",
      "duration": "1-2 weeks",
      "skills": ["skill1", "skill2"],
      "tasks": ["task1", "task2"],
      "projects": ["project1"]
    },
    {
      "title": "Core Skills",
      "duration": "2-3 weeks",
      "skills": ["skill1", "skill2"],
      "tasks": ["task1", "task2"],
      "projects": ["project1"]
    }
  ]
}`;

    console.log('📤 Generating roadmap for:', role);

    let response;
    try {
      response = await callOpenRouter([
        { role: 'system', content: 'You are a career coach. Respond with valid JSON only. Make roadmaps specific to the role.' },
        { role: 'user', content: prompt }
      ]);
    } catch (aiError) {
      console.error('❌ AI Error:', aiError.message);
      const fallback = generateFallbackRoadmap(role);
      return res.json({
        roadmap: fallback,
        _meta: { 
          status: 'ai_fallback', 
          message: 'AI failed, using role-specific fallback',
          role: role
        }
      });
    }

    const result = response.choices[0].message.content;
    console.log('📥 Raw AI response:', result.substring(0, 300));

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (e) {
      console.error('❌ Parse error:', e.message);
      const fallback = generateFallbackRoadmap(role);
      return res.json({
        roadmap: fallback,
        _meta: { 
          status: 'parse_fallback', 
          message: 'Failed to parse AI response, using role-specific fallback',
          role: role
        }
      });
    }

    if (!parsed.levels || !Array.isArray(parsed.levels) || parsed.levels.length === 0) {
      const fallback = generateFallbackRoadmap(role);
      return res.json({
        roadmap: fallback,
        _meta: { 
          status: 'structure_fallback', 
          message: 'Invalid response structure, using role-specific fallback',
          role: role
        }
      });
    }

    const cleanedLevels = parsed.levels.map((level, index) => ({
      title: level.title || `Phase ${index + 1}`,
      duration: level.duration || '1-2 weeks',
      phase: `Phase ${index + 1}`,
      skills: cleanArray(level.skills),
      tasks: (level.tasks || []).map(t => ({ 
        title: typeof t === 'string' ? t : t.title || t,
        completed: false 
      })),
      projects: cleanArray(level.projects)
    }));

    const finalLevels = cleanedLevels.map(level => ({
      ...level,
      skills: level.skills.length > 0 ? level.skills : ['Learn core concepts'],
      tasks: level.tasks.length > 0 ? level.tasks : [{ title: 'Build practice projects', completed: false }],
      projects: level.projects.length > 0 ? level.projects : ['Portfolio project']
    }));

    const roadmapData = {
      role,
      levels: finalLevels
    };

    res.json({
      roadmap: roadmapData,
      _meta: {
        status: 'success',
        model_used: response.model || 'unknown',
        skills_analyzed: allNeededSkills.length,
        phases_generated: finalLevels.length,
        role: role,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Roadmap Error:', error.message);
    const fallback = generateFallbackRoadmap(req.body.role || 'Full Stack Developer');
    res.json({
      roadmap: fallback,
      _meta: {
        status: 'error_fallback',
        message: error.message,
        role: req.body.role || 'Full Stack Developer'
      }
    });
  }
};

// ============================================================
// 6. SAVE ROADMAP
// ============================================================
const saveRoadmap = async (req, res) => {
  try {
    const { role, levels } = req.body;

    if (!role || !levels) {
      return res.status(400).json({ error: 'Role and levels are required' });
    }

    let totalTasks = 0;
    let completedTasks = 0;

    levels.forEach(phase => {
      phase.tasks.forEach(task => {
        totalTasks++;
        if (task.completed) completedTasks++;
      });
    });

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    let totalWeeks = 0;
    levels.forEach(phase => {
      const match = phase.duration?.match(/\d+/);
      if (match) totalWeeks += parseInt(match[0]);
    });

    await Roadmap.updateMany(
      { userId: DEFAULT_USER, isActive: true },
      { isActive: false }
    );

    const roadmap = new Roadmap({
      userId: DEFAULT_USER,
      role,
      levels,
      totalWeeks,
      totalTasks,
      completedTasks,
      progress,
      isActive: true
    });

    await roadmap.save();

    res.json({
      success: true,
      roadmap,
      _meta: {
        status: 'saved',
        totalTasks,
        completedTasks,
        progress: `${progress}%`
      }
    });

  } catch (error) {
    console.error('❌ Save Roadmap Error:', error.message);
    res.status(500).json({
      error: 'Failed to save roadmap',
      message: error.message
    });
  }
};

// ============================================================
// 7. GET ROADMAP
// ============================================================
const getRoadmap = async (req, res) => {
  try {
    const roadmap = await Roadmap.findOne({ 
      userId: DEFAULT_USER, 
      isActive: true 
    }).sort({ createdAt: -1 });

    if (!roadmap) {
      return res.json({
        success: true,
        roadmap: null,
        message: 'No active roadmap found'
      });
    }

    res.json({
      success: true,
      roadmap
    });

  } catch (error) {
    console.error('❌ Get Roadmap Error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch roadmap',
      message: error.message
    });
  }
};

// ============================================================
// 8. TOGGLE TASK - UPDATED
// ============================================================
const toggleTask = async (req, res) => {
  try {
    const { roadmapId, phaseIndex, taskIndex } = req.body;

    if (roadmapId === undefined || phaseIndex === undefined || taskIndex === undefined) {
      return res.status(400).json({
        error: 'roadmapId, phaseIndex, and taskIndex are required'
      });
    }

    const roadmap = await Roadmap.findById(roadmapId);

    if (!roadmap) {
      return res.status(404).json({ error: 'Roadmap not found' });
    }

    if (!roadmap.levels[phaseIndex]) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    if (!roadmap.levels[phaseIndex].tasks[taskIndex]) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = roadmap.levels[phaseIndex].tasks[taskIndex];
    const wasCompleted = task.completed;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date() : null;

    let updatedSkills = [];

    if (task.completed && !wasCompleted) {
      const phase = roadmap.levels[phaseIndex];
      
      for (const skillName of phase.skills) {
        const updated = await updateSkillLevel(roadmap.userId, skillName, 1);
        if (updated) {
          updatedSkills.push({
            name: updated.skillName,
            level: updated.level,
            skillId: updated.skillId
          });
        }
      }
    }

    roadmap.calculateProgress();
    await roadmap.save();

    res.json({
      success: true,
      task: {
        title: task.title,
        completed: task.completed,
        completedAt: task.completedAt
      },
      progress: roadmap.progress,
      completedTasks: roadmap.completedTasks,
      totalTasks: roadmap.totalTasks,
      updatedSkills: updatedSkills,
      wasCompleted: wasCompleted
    });

  } catch (error) {
    console.error('❌ Toggle Task Error:', error.message);
    res.status(500).json({
      error: 'Failed to toggle task',
      message: error.message
    });
  }
};

// ============================================================
// 9. DELETE ROADMAP
// ============================================================
const deleteRoadmap = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Roadmap ID is required' });
    }

    const roadmap = await Roadmap.findByIdAndDelete(id);

    if (!roadmap) {
      return res.status(404).json({ error: 'Roadmap not found' });
    }

    res.json({
      success: true,
      message: 'Roadmap deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete Roadmap Error:', error.message);
    res.status(500).json({
      error: 'Failed to delete roadmap',
      message: error.message
    });
  }
};

// ============================================================
// 10. TEST ROUTE
// ============================================================
const testRoadmap = async (req, res) => {
  res.json({
    success: true,
    message: '✅ Roadmap routes are working!',
    endpoints: {
      get: 'GET /roadmap',
      save: 'POST /roadmap/save',
      generate: 'POST /roadmap/generate',
      toggle: 'POST /roadmap/toggle'
    }
  });
};

// ============================================================
// 11. EXPORTS
// ============================================================
module.exports = {
  generateRoadmap,
  saveRoadmap,
  getRoadmap,
  toggleTask,
  deleteRoadmap,
  testRoadmap
};