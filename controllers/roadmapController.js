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
// 2. FALLBACK ROADMAP
// ============================================================
const generateFallbackRoadmap = (role) => {
  const commonRoadmaps = {
    'frontend': {
      levels: [
        {
          title: 'Frontend Foundations',
          duration: '1-2 weeks',
          phase: 'Phase 1',
          skills: ['HTML', 'CSS', 'JavaScript'],
          tasks: [{ title: 'Build static website' }, { title: 'Learn CSS Flexbox & Grid' }],
          projects: ['Portfolio Website']
        },
        {
          title: 'React & Modern Frontend',
          duration: '2-3 weeks',
          phase: 'Phase 2',
          skills: ['React', 'Tailwind CSS', 'State Management'],
          tasks: [{ title: 'Build React components' }, { title: 'Implement routing' }],
          projects: ['E-commerce Frontend']
        }
      ]
    },
    'fullstack': {
      levels: [
        {
          title: 'Frontend Foundations',
          duration: '1-2 weeks',
          phase: 'Phase 1',
          skills: ['HTML', 'CSS', 'JavaScript'],
          tasks: [{ title: 'Build static website' }, { title: 'Learn CSS Flexbox & Grid' }],
          projects: ['Portfolio Website']
        },
        {
          title: 'Backend & APIs',
          duration: '2-3 weeks',
          phase: 'Phase 2',
          skills: ['Node.js', 'Express', 'MongoDB'],
          tasks: [{ title: 'Build REST API' }, { title: 'Connect to database' }],
          projects: ['REST API Service']
        },
        {
          title: 'Full Stack Integration',
          duration: '2-3 weeks',
          phase: 'Phase 3',
          skills: ['React', 'Node.js', 'JWT Auth'],
          tasks: [{ title: 'Connect frontend to backend' }, { title: 'Add authentication' }],
          projects: ['Full Stack Blog App']
        }
      ]
    }
  };

  const roleLower = role.toLowerCase();
  let fallback = commonRoadmaps.frontend;

  for (const [key, value] of Object.entries(commonRoadmaps)) {
    if (roleLower.includes(key)) {
      fallback = value;
      break;
    }
  }

  return {
    role,
    levels: fallback.levels.map(level => ({
      ...level,
      skills: cleanArray(level.skills),
      tasks: level.tasks.map(t => ({ title: t.title || t, completed: false })),
      projects: cleanArray(level.projects)
    }))
  };
};

// ============================================================
// 3. CALL OPENROUTER
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
// 4. GENERATE ROADMAP
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
        _meta: { status: 'fallback', message: 'No skills provided, using fallback' }
      });
    }

    const prompt = `You are an expert career coach. Generate a clean, structured learning roadmap for: ${role}

User already knows: ${existingSkills.join(', ') || 'None yet'}

Skills they need to learn: ${allNeededSkills.join(', ')}

STRICT RULES:
- skills = ONLY technologies or concepts (e.g. React, Node.js, REST APIs)
- tasks = ACTIONABLE steps (e.g. Build authentication system, Create REST endpoints)
- projects = CONCRETE portfolio projects (e.g. E-commerce website, Blog API)
- DO NOT include weaknesses, explanations, or "improve" statements
- DO NOT repeat items across phases
- Keep items SHORT (max 6 words each)

Return ONLY JSON:
{
  "levels": [
    {
      "title": "Foundations",
      "duration": "1-2 weeks",
      "skills": ["skill1", "skill2"],
      "tasks": ["task1", "task2"],
      "projects": ["project1"]
    }
  ]
}`;

    console.log('📤 Generating roadmap for:', role);

    const response = await callOpenRouter([
      { role: 'system', content: 'You are a career coach. Respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    console.log('📥 Raw response:', result.substring(0, 200));

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
        _meta: { status: 'fallback', message: 'Failed to parse AI response' }
      });
    }

    if (!parsed.levels || !Array.isArray(parsed.levels) || parsed.levels.length === 0) {
      const fallback = generateFallbackRoadmap(role);
      return res.json({
        roadmap: fallback,
        _meta: { status: 'fallback', message: 'Invalid response structure' }
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
        message: error.message
      }
    });
  }
};

// ============================================================
// 5. SAVE ROADMAP
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
// 6. GET ROADMAP
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
// 7. TOGGLE TASK
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
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date() : null;

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
      totalTasks: roadmap.totalTasks
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
// 8. DELETE ROADMAP
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
// 9. TEST ROUTE
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
// 10. EXPORTS
// ============================================================
module.exports = {
  generateRoadmap,
  saveRoadmap,
  getRoadmap,
  toggleTask,
  deleteRoadmap,
  testRoadmap
};