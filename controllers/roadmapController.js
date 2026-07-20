const Skill = require('../models/Skill');
const SkillRegistry = require('../models/SkillRegistry');

const DEFAULT_USER = 'default-user';

// ============================================================
// 1. SANITIZATION FUNCTIONS
// ============================================================
const cleanArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  
  const cleaned = [...new Set(arr)] // Remove duplicates
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
  
  return cleaned.slice(0, 6); // Max 6 items per section
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
          skills: ['HTML', 'CSS', 'JavaScript'],
          tasks: ['Build static website', 'Learn CSS Flexbox & Grid', 'Build interactive components'],
          projects: ['Portfolio Website']
        },
        {
          title: 'React & Modern Frontend',
          duration: '2-3 weeks',
          skills: ['React', 'Tailwind CSS', 'State Management'],
          tasks: ['Build React components', 'Implement routing', 'Add state management'],
          projects: ['E-commerce Frontend', 'Blog Application']
        },
        {
          title: 'Advanced Frontend',
          duration: '1-2 weeks',
          skills: ['TypeScript', 'Next.js', 'Performance Optimization'],
          tasks: ['Type-safe components', 'Build Next.js app', 'Optimize performance'],
          projects: ['Full-stack Next.js App']
        }
      ]
    },
    'fullstack': {
      levels: [
        {
          title: 'Frontend Foundations',
          duration: '1-2 weeks',
          skills: ['HTML', 'CSS', 'JavaScript'],
          tasks: ['Build static website', 'Learn CSS Flexbox & Grid'],
          projects: ['Portfolio Website']
        },
        {
          title: 'Backend & APIs',
          duration: '2-3 weeks',
          skills: ['Node.js', 'Express', 'MongoDB'],
          tasks: ['Build REST API', 'Connect to database', 'Implement authentication'],
          projects: ['REST API Service']
        },
        {
          title: 'Full Stack Integration',
          duration: '2-3 weeks',
          skills: ['React', 'Node.js', 'JWT Auth'],
          tasks: ['Connect frontend to backend', 'Add authentication', 'Build full-stack app'],
          projects: ['Full Stack Blog App', 'Task Management App']
        }
      ]
    },
    'backend': {
      levels: [
        {
          title: 'Backend Foundations',
          duration: '1-2 weeks',
          skills: ['Node.js', 'Express', 'REST APIs'],
          tasks: ['Build basic server', 'Create REST endpoints', 'Implement error handling'],
          projects: ['Basic API Service']
        },
        {
          title: 'Database & Authentication',
          duration: '2-3 weeks',
          skills: ['MongoDB', 'JWT Auth', 'PostgreSQL'],
          tasks: ['Connect to database', 'Build auth system', 'Add role-based access'],
          projects: ['User Management API']
        },
        {
          title: 'Advanced Backend',
          duration: '1-2 weeks',
          skills: ['Docker', 'AWS', 'System Design'],
          tasks: ['Containerize app', 'Deploy to cloud', 'Design scalable system'],
          projects: ['Production API Service']
        }
      ]
    }
  };

  // Find matching role
  const roleLower = role.toLowerCase();
  let fallback = commonRoadmaps.frontend; // Default

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
      tasks: cleanArray(level.tasks),
      projects: cleanArray(level.projects)
    }))
  };
};

// ============================================================
// 3. ROADMAP GENERATOR
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

    // Get user's skills for context
    const skills = await Skill.find({ user: DEFAULT_USER });
    const existingSkills = skills.map(s => s.skillName);

    // ✅ Build combined skill list (what they need to learn)
    const allNeededSkills = [...new Set([
      ...(missingSkills || []),
      ...(suggestedSkills || [])
    ])].filter(s => s && s.length > 0);

    // If no skills provided, use fallback
    if (allNeededSkills.length === 0) {
      return res.json({
        roadmap: generateFallbackRoadmap(role),
        _meta: {
          status: 'fallback',
          message: 'No skills provided, using fallback roadmap',
          role
        }
      });
    }

    // ✅ Build the AI prompt - STRICT STRUCTURE
    const prompt = `You are an expert career coach. Generate a clean, structured learning roadmap for: ${role}

User already knows: ${existingSkills.join(', ') || 'None yet'}

Skills they need to learn: ${allNeededSkills.join(', ')}

STRICT RULES:
- skills = ONLY technologies or concepts (e.g. React, Node.js, REST APIs)
- tasks = ACTIONABLE steps (e.g. Build authentication system, Create REST endpoints)
- projects = CONCRETE portfolio projects (e.g. E-commerce website, Blog API)
- DO NOT include weaknesses, explanations, or "improve" statements anywhere
- DO NOT repeat items across phases
- Keep items SHORT (max 6 words each)
- DO NOT include items longer than 50 characters

Return ONLY JSON with this EXACT structure (no other text):

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
}

Make sure skills, tasks, and projects are all DIFFERENT from each other.
Skills go in "skills", actions go in "tasks", portfolio items go in "projects".`;

    console.log('📤 Generating roadmap for:', role);

    // ✅ Call OpenRouter
    const response = await callOpenRouter([
      { role: 'system', content: 'You are a career coach. Respond with valid JSON only. Use the exact structure provided. Never include explanations.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    console.log('📥 Raw response:', result.substring(0, 200));

    // ✅ Parse JSON
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
      // ✅ Use fallback
      const fallback = generateFallbackRoadmap(role);
      return res.json({
        roadmap: fallback,
        _meta: {
          status: 'fallback',
          message: 'Failed to parse AI response, using fallback',
          role
        }
      });
    }

    // ✅ Validate structure
    if (!parsed.levels || !Array.isArray(parsed.levels) || parsed.levels.length === 0) {
      console.error('❌ Invalid structure:', parsed);
      const fallback = generateFallbackRoadmap(role);
      return res.json({
        roadmap: fallback,
        _meta: {
          status: 'fallback',
          message: 'Invalid response structure, using fallback',
          role
        }
      });
    }

    // ✅ CLEAN AND SANITIZE
    const cleanedLevels = parsed.levels.map((level, index) => ({
      title: level.title || `Phase ${index + 1}`,
      duration: level.duration || '1-2 weeks',
      skills: cleanArray(level.skills),
      tasks: cleanArray(level.tasks),
      projects: cleanArray(level.projects),
      phase: `Phase ${index + 1}`
    }));

    // ✅ Ensure each level has at least one item
    const finalLevels = cleanedLevels.map(level => ({
      ...level,
      skills: level.skills.length > 0 ? level.skills : ['Learn core concepts'],
      tasks: level.tasks.length > 0 ? level.tasks : ['Build practice projects'],
      projects: level.projects.length > 0 ? level.projects : ['Portfolio project']
    }));

    // ✅ Return clean roadmap
    res.json({
      roadmap: {
        role,
        levels: finalLevels
      },
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
    // ✅ Always return fallback - NEVER crash
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
// 4. CALL OPENROUTER HELPER
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

module.exports = {
  generateRoadmap
};