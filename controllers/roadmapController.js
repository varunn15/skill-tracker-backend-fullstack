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

    const skills = await Skill.find({ user: req.user.id });
    const existingSkills = skills.map(s => s.skillName);

    const allNeededSkills = [...new Set([
      ...(missingSkills || []),
      ...(suggestedSkills || [])
    ])].filter(s => s && s.length > 0);

    if (!process.env.OPENROUTER_API_KEY) {
      console.log(`⚠️ [ROADMAP GENERATOR] OPENROUTER_API_KEY not found. Serving custom handcrafted roadmap for: ${role}`);
      
      const roleLower = role.toLowerCase();
      let fallbackLevels = [];

      if (roleLower.includes('front')) {
        fallbackLevels = [
          {
            title: "Phase 1: Web Foundations & Styling",
            duration: "2 weeks",
            skills: ["HTML", "CSS", "Tailwind CSS", "Git"],
            tasks: [
              { title: "Develop a semantic HTML layout", completed: false },
              { title: "Build responsive grids and flexbox", completed: false },
              { title: "Configure Tailwind CSS in a project", completed: false }
            ],
            projects: ["Responsive Portfolio Website"]
          },
          {
            title: "Phase 2: JavaScript & Interactive UI",
            duration: "2 weeks",
            skills: ["JavaScript", "TypeScript", "React"],
            tasks: [
              { title: "Implement ES6 Array manipulation", completed: false },
              { title: "Build custom interactive form", completed: false },
              { title: "Develop custom React Hook", completed: false }
            ],
            projects: ["Interactive Todo Dashboard"]
          },
          {
            title: "Phase 3: Advanced Frontend Engineering",
            duration: "3 weeks",
            skills: ["Next.js", "React", "Redux Toolkit", "API Integration"],
            tasks: [
              { title: "Implement Next.js Server Components", completed: false },
              { title: "Integrate REST API with Axios", completed: false },
              { title: "Manage global state with Redux", completed: false }
            ],
            projects: ["Full-featured Kanban Management App"]
          }
        ];
      } else if (roleLower.includes('back')) {
        fallbackLevels = [
          {
            title: "Phase 1: Server Basics & Routing",
            duration: "2 weeks",
            skills: ["JavaScript", "Node.js", "Express.js", "Git"],
            tasks: [
              { title: "Build basic Express server", completed: false },
              { title: "Create modular routing systems", completed: false },
              { title: "Write error-handling middlewares", completed: false }
            ],
            projects: ["Task REST API Service"]
          },
          {
            title: "Phase 2: Data Modeling & Auth",
            duration: "2 weeks",
            skills: ["MongoDB", "PostgreSQL", "JSON Web Tokens"],
            tasks: [
              { title: "Design Mongoose schema validation", completed: false },
              { title: "Implement secure password hashing", completed: false },
              { title: "Build JWT authorization middleware", completed: false }
            ],
            projects: ["Secure User Authentication API"]
          },
          {
            title: "Phase 3: Advanced Backend & Containers",
            duration: "3 weeks",
            skills: ["Docker", "AWS", "Redis", "Jest"],
            tasks: [
              { title: "Write Docker multi-stage build", completed: false },
              { title: "Configure local Redis caching", completed: false },
              { title: "Write Jest backend unit tests", completed: false }
            ],
            projects: ["Scaleable Microservice Blog Engine"]
          }
        ];
      } else if (roleLower.includes('analyst') || roleLower.includes('data')) {
        fallbackLevels = [
          {
            title: "Phase 1: Data Structuring & SQL",
            duration: "2 weeks",
            skills: ["SQL", "MySQL", "PostgreSQL", "Excel"],
            tasks: [
              { title: "Write complex JOIN queries", completed: false },
              { title: "Develop subqueries and CTEs", completed: false },
              { title: "Create pivot charts and formulas", completed: false }
            ],
            projects: ["Corporate Financial Data Analysis"]
          },
          {
            title: "Phase 2: Programming & Data Wrangling",
            duration: "2 weeks",
            skills: ["Python", "Pandas", "Numpy", "Git"],
            tasks: [
              { title: "Parse dirty CSV with Pandas", completed: false },
              { title: "Filter and aggregate data sets", completed: false },
              { title: "Handle empty/missing values", completed: false }
            ],
            projects: ["Dynamic Dataset Cleaning System"]
          },
          {
            title: "Phase 3: Visual Analytics & Reporting",
            duration: "3 weeks",
            skills: ["Python", "Matplotlib", "Seaborn", "Tableau"],
            tasks: [
              { title: "Build multi-variable line plots", completed: false },
              { title: "Construct interactive dashboard", completed: false },
              { title: "Write final slide presentation", completed: false }
            ],
            projects: ["Executive Marketing Campaign Dashboard"]
          }
        ];
      } else if (roleLower.includes('design') || roleLower.includes('ux') || roleLower.includes('ui')) {
        fallbackLevels = [
          {
            title: "Phase 1: Design Principles & Figma",
            duration: "2 weeks",
            skills: ["Figma", "Typography", "Visual Design", "Color Theory"],
            tasks: [
              { title: "Construct a typography scale", completed: false },
              { title: "Design high-contrast button set", completed: false },
              { title: "Build reusable layout grids", completed: false }
            ],
            projects: ["Aesthetic Landing Page Visual Concept"]
          },
          {
            title: "Phase 2: UX Research & Wireframing",
            duration: "2 weeks",
            skills: ["UX Research", "Wireframing", "User flows", "Prototyping"],
            tasks: [
              { title: "Conduct user feedback session", completed: false },
              { title: "Design low-fidelity wireframes", completed: false },
              { title: "Build clickable linear prototype", completed: false }
            ],
            projects: ["Ride-sharing App Checkout Flow"]
          },
          {
            title: "Phase 3: Design Systems & Handover",
            duration: "3 weeks",
            skills: ["Figma components", "CSS", "Design Systems", "Prototyping"],
            tasks: [
              { title: "Build Figma auto-layout library", completed: false },
              { title: "Export design specs to SVG/CSS", completed: false },
              { title: "Develop micro-interactive cards", completed: false }
            ],
            projects: ["SaaS Administration Control Center Mockup"]
          }
        ];
      } else {
        // Universal fallback for any custom role using dynamic user skills
        const firstSkill = allNeededSkills[0] || 'Core Foundation';
        const secondSkill = allNeededSkills[1] || 'Intermediate Tools';
        const thirdSkill = allNeededSkills[2] || 'Advanced Concepts';

        fallbackLevels = [
          {
            title: `Phase 1: Getting Started with ${role}`,
            duration: "2 weeks",
            skills: [firstSkill, "Git", "Fundamental Concepts"],
            tasks: [
              { title: `Set up local workspace for ${firstSkill}`, completed: false },
              { title: `Learn syntax and fundamentals of ${firstSkill}`, completed: false },
              { title: `Commit first codebase to Git repository`, completed: false }
            ],
            projects: [`${firstSkill} Practice Sandbox App`]
          },
          {
            title: `Phase 2: Core Workflows of ${role}`,
            duration: "2 weeks",
            skills: [secondSkill, "Frameworks", "Data Management"],
            tasks: [
              { title: `Integrate ${secondSkill} into a structured flow`, completed: false },
              { title: `Create database structures or API endpoints`, completed: false },
              { title: `Perform error handling and validations`, completed: false }
            ],
            projects: [`${role} Core Functional Application`]
          },
          {
            title: `Phase 3: Deep Customization & Architecture`,
            duration: "3 weeks",
            skills: [thirdSkill, "Production Best Practices", "Testing"],
            tasks: [
              { title: `Implement advanced design/development patterns with ${thirdSkill}`, completed: false },
              { title: `Configure automated workflows or pipelines`, completed: false },
              { title: `Write solid unit tests and debug issues`, completed: false }
            ],
            projects: [`Complete Production-ready ${role} Portfolio System`]
          }
        ];
      }

      const fallbackCleaned = fallbackLevels.map((lvl, idx) => ({
        title: lvl.title,
        duration: lvl.duration,
        phase: `Phase ${idx + 1}`,
        skills: lvl.skills,
        tasks: lvl.tasks.map(t => ({ title: t.title, completed: false })),
        projects: lvl.projects
      }));

      const roadmapData = {
        role: role.trim(),
        levels: fallbackCleaned
      };

      return res.json({
        roadmap: roadmapData,
        _meta: {
          status: 'success',
          isFallback: true,
          skills_analyzed: allNeededSkills.length,
          phases_generated: fallbackCleaned.length,
          role: role.trim(),
          timestamp: new Date().toISOString()
        }
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
        userId: req.user.id, 
        role: { $regex: new RegExp(`^${role.trim()}$`, 'i') },
        isActive: true 
      },
      { isActive: false }
    );

    const roadmap = new Roadmap({
      userId: req.user.id,
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
    
    let query = { userId: req.user.id };
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
        userId: req.user.id,
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
