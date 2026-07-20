const { OpenAI } = require('openai');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// ============================================================
// 1. CHECK API KEY
// ============================================================
const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('❌ OPENROUTER_API_KEY is MISSING!');
  console.error('📝 Get your key from: https://openrouter.ai/keys');
}

// ============================================================
// 2. INITIALIZE OPENROUTER
// ============================================================
let openrouter;
let isInitialized = false;

try {
  if (API_KEY) {
    openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: API_KEY,
      timeout: 120000,
      defaultHeaders: {
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5000',
        'X-Title': 'Skill Tracker App',
      }
    });
    isInitialized = true;
    console.log('✅ OpenRouter initialized successfully');
  } else {
    console.error('❌ OpenRouter NOT initialized - API key missing');
  }
} catch (error) {
  console.error('❌ OpenRouter initialization failed:', error.message);
}

// ============================================================
// 3. FREE MODELS
// ============================================================
const FREE_MODELS = [
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "mistralai/mixtral-8x7b-instruct",     // Best free model
  "openchat/openchat-3.5",                // Good fallback
  "google/gemini-pro",                    // Another fallback
  "meta-llama/llama-2-13b-chat:free",
];

// ============================================================
// 4. CALL OPENROUTER
// ============================================================
const callOpenRouter = async (messages) => {
  if (!API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  if (!isInitialized) {
    throw new Error('OpenRouter failed to initialize');
  }

  let lastError = null;

  for (const model of FREE_MODELS) {
    try {
      console.log(`🤖 Trying model: ${model}`);
      const response = await openrouter.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: 800,
        temperature: 0.7,
      });
      console.log(`✅ Model ${model} responded!`);
      return response;
    } catch (error) {
      console.error(`❌ Model ${model} failed:`, error.message);
      lastError = { model, message: error.message };
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  throw new Error(`All models failed: ${lastError?.message || 'Unknown error'}`);
};

// ============================================================
// 5. GET ROLE FROM REQUEST (works for both GET and POST)
// ============================================================
const getRoleFromRequest = (req) => {
  return req.body?.role || req.query?.role || null;
};

// ============================================================
// 6. FALLBACK ANALYSIS (if AI fails)
// ============================================================
const generateFallbackAnalysis = (skills, role) => {
  const total = skills.length;
  const avgLevel = skills.reduce((sum, s) => sum + s.level, 0) / total || 0;
  
  const score = Math.min(Math.round((total * 5 + avgLevel * 5)), 85);
  
  const strengths = skills
    .filter(s => s.level >= 7)
    .map(s => `${s.skillName} (${s.level}/10)`);
  
  const weaknesses = skills
    .filter(s => s.level < 4)
    .map(s => `${s.skillName} (${s.level}/10)`);
  
  let summary = '';
  if (score >= 70) {
    summary = `You have ${total} skills averaging ${Math.round(avgLevel)}/10. You're well prepared for ${role}! 🎯`;
  } else if (score >= 50) {
    summary = `You have ${total} skills averaging ${Math.round(avgLevel)}/10. You're on the right track for ${role}.`;
  } else if (score >= 30) {
    summary = `You have ${total} skills averaging ${Math.round(avgLevel)}/10. You're building a foundation for ${role}.`;
  } else {
    summary = `You have ${total} skills but you're just starting out with ${role}. Focus on learning core skills.`;
  }

  return {
    score: Math.max(score, 10),
    strengths: strengths.length > 0 ? strengths : ['Has skills to build on'],
    weaknesses: weaknesses.length > 0 ? weaknesses : ['Needs more experience'],
    recommendations: [
      total < 5 ? 'Add more skills to build a stronger profile' : 'Deepen your existing skills',
      avgLevel < 6 ? 'Focus on improving skill levels' : 'Build complex projects',
      'Create a portfolio to showcase your work'
    ],
    summary: summary,
    _meta: { status: 'fallback' }
  };
};

// ============================================================
// 7. GET AI INSIGHTS
// ============================================================
const getAIInsights = async (req, res) => {
  console.log(`📥 ${req.method} /ai/insights called`);
  
  try {
    const role = getRoleFromRequest(req);
    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.json({
        insight: '📝 No skills found. Add skills to get AI insights.',
        suggestedSkills: ['React', 'Node.js', 'Python', 'Docker', 'AWS'],
        missingSkills: [],
        _meta: {
          status: 'no_skills',
          message: 'Add at least 1 skill to get AI-powered insights',
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!isInitialized || !API_KEY) {
      return res.status(503).json({
        error: 'AI service unavailable',
        insight: '⚠️ OpenRouter AI is not configured. Please set OPENROUTER_API_KEY.',
        suggestedSkills: [],
        missingSkills: [],
        _meta: {
          status: 'ai_unavailable',
          timestamp: new Date().toISOString()
        }
      });
    }

    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category || 'Uncategorized'})`
    ).join('\n');

    const prompt = `You are a career coach. Analyze these skills and provide insights.

SKILLS:
${skillsSummary}

${role ? `TARGET ROLE: ${role}` : 'Provide general recommendations.'}

Return ONLY valid JSON (no other text):
{
  "insight": "specific, encouraging 1-2 sentence insight about their skill profile",
  "suggestedSkills": ["skill1", "skill2", "skill3"],
  "missingSkills": ["skill1", "skill2"]
}`;

    console.log('📤 Sending to AI for insights...');

    const response = await callOpenRouter([
      { role: 'system', content: 'You are a career coach. Respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    console.log('📥 AI Response:', result.substring(0, 200) + '...');

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('❌ Parse Error:', parseError.message);
      return res.json({
        insight: `You have ${skills.length} skills. Keep building your expertise! 💪`,
        suggestedSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'Docker'],
        missingSkills: ['TypeScript', 'Testing', 'System Design']
      });
    }

    res.json({
      insight: parsed.insight || 'Keep building your skills! 💪',
      suggestedSkills: parsed.suggestedSkills || ['JavaScript', 'React', 'Node.js'],
      missingSkills: parsed.missingSkills || [],
      _meta: {
        status: 'success',
        model_used: response.model || 'unknown',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ AI Insights Error:', error.message);
    const skills = await Skill.find({ user: DEFAULT_USER });
    res.json({
      insight: `You have ${skills.length} skills. Keep building your expertise! 💪`,
      suggestedSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'Docker'],
      missingSkills: ['TypeScript', 'Testing', 'System Design']
    });
  }
};

// ============================================================
// 8. GET CAREER READINESS - UPDATED
// ============================================================
const getCareerReadiness = async (req, res) => {
  console.log(`📥 ${req.method} /ai/readiness called`);
  
  try {
    const role = getRoleFromRequest(req);
    
    if (!role) {
      return res.status(400).json({ 
        error: 'Role is required. Use ?role=Frontend or { "role": "Frontend" }',
        _meta: { status: 'missing_role' }
      });
    }

    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.json({
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Add skills to get career analysis'],
        summary: 'No skills found. Add skills to get a real assessment.',
        _meta: { status: 'no_skills' }
      });
    }

    if (!isInitialized || !API_KEY) {
      return res.status(503).json({
        error: 'AI service unavailable',
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Set OPENROUTER_API_KEY to enable AI analysis'],
        summary: '⚠️ AI service is not configured.',
        _meta: { status: 'ai_unavailable' }
      });
    }

    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category || 'Uncategorized'})`
    ).join('\n');

    // ✅ STRICT PROMPT - NO EMPTY RESPONSES
    const prompt = `You are a brutally honest career coach. Analyze these skills for the role: ${role}

SKILLS:
${skillsSummary}

⚠️ IMPORTANT RULES:
1. NEVER return empty arrays. Always provide at least 2-3 items.
2. Be SPECIFIC - reference actual skill names and levels.
3. Score HONESTLY:
   - 80-100: Expert (7+ skills at level 8+)
   - 60-79: Strong (5+ skills at level 6+)
   - 40-59: Moderate (3+ skills at level 4+)
   - 20-39: Beginner (1-3 skills at level 3+)
   - 0-19: Just starting (0-1 relevant skills)

Return ONLY valid JSON with this EXACT structure:
{
  "score": number,
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "weaknesses": ["specific weakness 1", "specific weakness 2", "specific weakness 3"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2", "actionable recommendation 3"],
  "summary": "detailed 2-3 sentence summary"
}

EXAMPLE:
{
  "score": 65,
  "strengths": ["HTML (8/10) - Strong foundation", "CSS (6/10) - Good styling skills"],
  "weaknesses": ["No JavaScript experience", "No framework knowledge"],
  "recommendations": ["Learn JavaScript ES6+ fundamentals", "Build a project with React", "Practice with CSS frameworks"],
  "summary": "You have a solid frontend foundation with HTML and CSS. To become a Frontend Developer, you need to learn JavaScript and a modern framework like React."
}`;

    console.log('📤 Sending to AI for career readiness...');

    const response = await callOpenRouter([
      { 
        role: 'system', 
        content: 'You are a career coach. Always respond with valid JSON. NEVER return empty arrays. Be specific and honest.' 
      },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    console.log('📥 AI Response:', result.substring(0, 300) + '...');

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
      return res.json(generateFallbackAnalysis(skills, role));
    }

    // ✅ Ensure no empty arrays
    const finalData = {
      score: Math.min(Math.max(parsed.score || 50, 10), 100),
      strengths: parsed.strengths && parsed.strengths.length > 0 
        ? parsed.strengths.slice(0, 5) 
        : ['Has technical skills to build on'],
      weaknesses: parsed.weaknesses && parsed.weaknesses.length > 0 
        ? parsed.weaknesses.slice(0, 5) 
        : ['Need to identify specific skill gaps'],
      recommendations: parsed.recommendations && parsed.recommendations.length > 0 
        ? parsed.recommendations.slice(0, 5) 
        : ['Continue building your skills', 'Create a portfolio project'],
      summary: parsed.summary || `AI analysis of your ${skills.length} skills for ${role}.`
    };

    res.json({
      ...finalData,
      _meta: {
        status: 'success',
        model_used: response.model || 'unknown',
        skills_analyzed: skills.length,
        role: role,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Career Readiness Error:', error.message);
    const skills = await Skill.find({ user: DEFAULT_USER });
    const role = req.body?.role || req.query?.role || 'your role';
    res.json(generateFallbackAnalysis(skills, role));
  }
};

// ============================================================
// 9. EXPORTS
// ============================================================
module.exports = {
  getAIInsights,
  getCareerReadiness
};