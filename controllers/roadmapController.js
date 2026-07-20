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
    const { role, missingSkills, suggestedSkills } = req.body;

    if (!role) {
      return res.status(400).json({
        error: 'Cannot load data',
        message: 'Role is required to generate a learning roadmap.'
      });
    }

    const skills = await Skill.find({ user: DEFAULT_USER });
    const existingSkills = skills.map(s => s.skillName);

    const allNeededSkills = [...new Set([
      ...(missingSkills || []),
      ...(suggestedSkills || [])
    ])].filter(s => s && s.length > 0);

    if (allNeededSkills.length === 0) {
      return res.status(400).json({
        error: 'Cannot load data',
        message: 'No skills provided to generate a roadmap.'
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({
        error: 'Cannot load data',
        message: 'Cannot load data. AI service is not configured.'
      });
    }

    const prompt = `You are a career and technology coach. Generate a highly customized, specific learning roadmap for someone aiming to be a: ${role}

User's existing skills (already known): ${existingSkills.join(', ') || 'None yet'}
Skills to learn/improve: ${allNeededSkills.join(', ')}

⚠️ CRITICAL ROADMAP GENERATION INSTRUCTIONS:
- Create a 2-3 phase roadmap specifically built for becoming a ${role}.
- For each phase, provide a descriptive title, a realistic duration (e.g. "2 weeks"), 2-3 technical skills/tools, 2-3 concrete actionable practice tasks, and 1 specific portfolio project.
- Make all titles, tasks, and project descriptions highly relevant to ${role}. For example, if it's Frontend, tasks must be about UI, responsive design, components. If Backend, tasks must be about API development, databases, authentication.
- DO NOT use generic placeholders or reuse the same descriptions.
- Keep item descriptions concise and clear (max 6 words each).

Return ONLY a JSON object with this exact structure:
{
  "levels": [
    {
      "title": "Phase title matching the technologies",
      "duration": "1-2 weeks",
      "skills": ["specific tool/concept 1", "specific tool/concept 2"],
      "tasks": ["build task 1", "build task 2"],
      "projects": ["portfolio project name 1"]
    },
    {
      "title": "Phase title for advanced concepts",
      "duration": "2-3 weeks",
      "skills": ["advanced tool 1", "advanced tool 2"],
      "tasks": ["integrate task 1", "integrate task 2"],
      "projects": ["portfolio project name 2"]
    }
  ]
}`;

    console.log('📤 Generating roadmap for:', role);

    const parsed = await callOpenRouter(
      'You are a tech coach. Respond with valid JSON only. Do not use generic placeholders. Customize the phases for the target role.',
      prompt
    );

    if (!parsed.levels || !Array.isArray(parsed.levels) || parsed.levels.length === 0) {
      return res.status(500).json({
        error: 'Cannot load data',
        message: 'Cannot load data. AI response structure was invalid.'
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
// 5. GET ROADMAP
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
