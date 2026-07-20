const { OpenAI } = require('openai');
const Roadmap = require('../models/Roadmap');
const Skill = require('../models/Skill');
const SkillRegistry = require('../models/SkillRegistry');

const DEFAULT_USER = 'default-user';

// Initialize OpenAI client with OpenRouter config
let openai = null;
const initOpenAI = () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing');
  }
  if (!openai) {
    openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://ai.studio/build',
        'X-Title': 'Skill Tracker App',
      }
    });
  }
  return openai;
};

// Robust list of OpenRouter models to try in sequence
const OPENROUTER_MODELS = [
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "mistralai/mixtral-8x7b-instruct",     // Best free model
  "openchat/openchat-3.5",                // Good fallback
  "google/gemini-pro",                    // Another fallback
  "meta-llama/llama-2-13b-chat:free",
];

/**
 * Sends a prompt to OpenRouter and tries multiple models in case of failure.
 * Returns parsed JSON or throws an error. No mock/fallback data is used.
 */
async function callOpenRouter(systemInstruction, prompt) {
  const client = initOpenAI();
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  let lastError = null;

  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(`🤖 Requesting OpenRouter model: ${model}`);
      const response = await client.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0.2, // Low temperature for consistent formatting
        response_format: { type: "json_object" } // Request JSON object if supported
      });

      const text = response.choices?.[0]?.message?.content;
      if (text) {
        console.log(`✅ Model ${model} responded successfully`);
        const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleaned);
        return parsed;
      }
    } catch (err) {
      console.error(`❌ Model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw new Error(lastError ? lastError.message : 'All OpenRouter models failed to respond.');
}

// ============================================================
// 1. SANITIZATION FUNCTIONS
// ============================================================
const cleanArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  
  const cleaned = [...new Set(arr)]
    .map(item => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        // Handle object output from LLM gracefully by extracting any string value
        return (item.name || item.title || item.skill || item.project || Object.values(item)[0] || '').toString().trim();
      }
      return '';
    })
    .filter(item => 
      item &&
      item.length < 60 &&
      item.length > 2 &&
      !item.toLowerCase().includes('experience') &&
      !item.toLowerCase().includes('ability') &&
      !item.toLowerCase().includes('lack') &&
      !item.toLowerCase().includes('limited') &&
      !item.toLowerCase().includes('knowledge') &&
      !item.toLowerCase().includes('understanding') &&
      !item.toLowerCase().includes('familiar')
    );
  
  return cleaned.slice(0, 6);
};

// ============================================================
// 2. UPDATE SKILL LEVEL ON TASK COMPLETION
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
// 3. GENERATE ROADMAP
// ============================================================
const generateRoadmap = async (req, res) => {
  try {
    const role = req.body?.role || req.query?.role;
    let missingSkills = req.body?.missingSkills || req.query?.missingSkills || [];
    let suggestedSkills = req.body?.suggestedSkills || req.query?.suggestedSkills || [];

    if (!role) {
      return res.status(400).json({
        error: 'Cannot load data',
        message: 'Role is required to generate a learning roadmap.'
      });
    }

    // Support comma-separated strings if passed as query parameters
    if (typeof missingSkills === 'string') {
      missingSkills = missingSkills.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof suggestedSkills === 'string') {
      suggestedSkills = suggestedSkills.split(',').map(s => s.trim()).filter(Boolean);
    }

    const skills = await Skill.find({ user: DEFAULT_USER });
    const existingSkills = skills.map(s => s.skillName);

    const allNeededSkills = [...new Set([
      ...(missingSkills || []),
      ...(suggestedSkills || [])
    ])].filter(s => s && s.length > 0);

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({
        error: 'Cannot load data',
        message: 'Cannot load data. AI service is not configured.'
      });
    }

    const prompt = `You are an elite career and technical mentor. Your goal is to generate a highly customized, specific, and extremely practical learning roadmap for becoming a: ${role}.

User's existing skills (already known): ${existingSkills.join(', ') || 'None yet'}
Core skills to focus on/learn: ${allNeededSkills.join(', ') || 'General role requirements for ' + role}

⚠️ STRICTOR ROADMAP INSTRUCTIONS:
1. Customize EVERY detail specifically for a ${role}. 
   - If the role is Backend, the skills MUST be real tools like Node.js, PostgreSQL, Docker; the tasks must be like "Implement JWT Auth", "Design schema in PostgreSQL"; the project must be like "REST API Blog Engine".
   - If the role is Frontend, the skills MUST be like CSS Grid, Tailwind, React hooks; the tasks must be like "Build responsive landing page", "Create infinite scroll hook"; the project must be like "Interactive Kanban Board".
   - If the role is DevOps, the skills MUST be like Docker, Kubernetes, Ansible, Github Actions; the tasks must be like "Build Docker multi-stage build", "Create CI/CD deployment pipeline"; the project must be like "Automated VPC Deploy".
   - If the role is Data Scientist, the skills MUST be like Python, Pandas, Scikit-Learn, SQL; the tasks must be like "Write data cleaning pipeline", "Train random forest classifier"; the project must be like "Customer Churn Predictor".
   - Never use generic words like "concept 1", "tool 1", "task 1", or "portfolio project 1".
2. Create exactly 3 progressive phases (e.g. Phase 1: Foundations, Phase 2: Core Skills, Phase 3: Advanced Concepts).
3. Do NOT repeat any skill, task, or project across different phases.
4. Keep all descriptions concise, precise, and practical (maximum 6 words per item).
5. Ensure the response is a valid JSON object.

Return ONLY a JSON object matching this exact schema:
{
  "levels": [
    {
      "title": "Phase 1: descriptive name customized for ${role}",
      "duration": "1-2 weeks",
      "skills": ["Real Tech/Tool 1", "Real Tech/Tool 2"],
      "tasks": ["Actionable build task 1", "Actionable build task 2"],
      "projects": ["Specific portfolio project name"]
    },
    {
      "title": "Phase 2: descriptive name customized for ${role}",
      "duration": "2 weeks",
      "skills": ["Real Tech/Tool 3", "Real Tech/Tool 4"],
      "tasks": ["Actionable build task 3", "Actionable build task 4"],
      "projects": ["Specific portfolio project name"]
    },
    {
      "title": "Phase 3: descriptive name customized for ${role}",
      "duration": "2-3 weeks",
      "skills": ["Real Tech/Tool 5", "Real Tech/Tool 6"],
      "tasks": ["Actionable build task 5", "Actionable build task 6"],
      "projects": ["Specific portfolio project name"]
    }
  ]
}`;

    console.log('📤 Generating roadmap for:', role);

    const parsed = await callOpenRouter(
      `You are a specialized technical coach for ${role}. Respond with valid JSON matching the exact schema only. Customize every phase.`,
      prompt
    );

    if (!parsed.levels || !Array.isArray(parsed.levels) || parsed.levels.length === 0) {
      return res.status(500).json({
        error: 'Cannot load data',
        message: 'Cannot load data. AI response structure was invalid.'
      });
    }

    const cleanedLevels = parsed.levels.map((level, index) => {
      // Robust task parser handling both string arrays and object arrays
      const tasks = (level.tasks || []).map(t => {
        let title = '';
        if (typeof t === 'string') {
          title = t;
        } else if (t && typeof t === 'object') {
          title = t.title || t.name || t.task || t.description || Object.values(t)[0] || '';
        }
        return { 
          title: title.toString().trim() || 'Implement core features',
          completed: false 
        };
      });

      return {
        title: level.title || `Phase ${index + 1}`,
        duration: level.duration || '1-2 weeks',
        phase: `Phase ${index + 1}`,
        skills: cleanArray(level.skills),
        tasks: tasks,
        projects: cleanArray(level.projects)
      };
    });

    const finalLevels = cleanedLevels.map(level => ({
      ...level,
      skills: level.skills.length > 0 ? level.skills : ['Core technology concepts'],
      tasks: level.tasks.length > 0 ? level.tasks : [{ title: 'Implement practice project features', completed: false }],
      projects: level.projects.length > 0 ? level.projects : ['Real-world portfolio app']
    }));

    const roadmapData = {
      role,
      levels: finalLevels
    };

    res.json({
      roadmap: roadmapData,
      _meta: {
        status: 'success',
        skills_analyzed: allNeededSkills.length,
        phases_generated: finalLevels.length,
        role: role,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Roadmap Error:', error.message);
    res.status(500).json({
      error: 'Cannot load data',
      message: `Cannot load data. AI service error: ${error.message}`
    });
  }
};

// ============================================================
// 4. SAVE ROADMAP
// ============================================================
const saveRoadmap = async (req, res) => {
  try {
    const { role, levels } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    if (!levels) {
      return res.status(400).json({ error: 'Levels are required' });
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

    // Deactivate previous active roadmaps FOR THIS ROLE ONLY, allowing the user to maintain active roadmaps for different roles.
    await Roadmap.updateMany(
      { 
        userId: DEFAULT_USER, 
        role: { $regex: new RegExp(`^${role.trim()}$`, 'i') },
        isActive: true 
      },
      { isActive: false }
    );

    const roadmap = new Roadmap({
      userId: DEFAULT_USER,
      role: role.trim(),
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
        progress: `${progress}%`,
        role: role.trim()
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
// 5. GET ROADMAP
// ============================================================
const getRoadmap = async (req, res) => {
  try {
    const role = req.query?.role || req.body?.role;
    
    let query = { userId: DEFAULT_USER };
    if (role) {
      // Find active/saved roadmap matching the requested role (case-insensitive)
      query.role = { $regex: new RegExp(`^${role.trim()}$`, 'i') };
      query.isActive = true;
    } else {
      // If no role specified, fall back to the most recently active/created roadmap
      query.isActive = true;
    }

    console.log(`🔍 [GET ROADMAP] Querying with:`, query);
    let roadmap = await Roadmap.findOne(query).sort({ createdAt: -1 });

    // Fallback: If not found with isActive: true for a specific role, find the latest roadmap of that role regardless of isActive status
    if (!roadmap && role) {
      console.log(`⚠️ [GET ROADMAP] No active roadmap found for "${role}". Trying fallback to find any created roadmap for this role.`);
      roadmap = await Roadmap.findOne({
        userId: DEFAULT_USER,
        role: { $regex: new RegExp(`^${role.trim()}$`, 'i') }
      }).sort({ createdAt: -1 });
    }

    if (!roadmap) {
      return res.json({
        success: true,
        roadmap: null,
        message: role ? `No saved roadmap found for role: ${role}` : 'No active roadmap found'
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
// 6. TOGGLE TASK - UPDATED
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
// 7. DELETE ROADMAP
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
// 8. TEST ROUTE
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

module.exports = {
  generateRoadmap,
  saveRoadmap,
  getRoadmap,
  toggleTask,
  deleteRoadmap,
  testRoadmap
};
