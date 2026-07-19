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
  'mistralai/mixtral-8x7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
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
  // ✅ Works for both GET (query) and POST (body)
  return req.body?.role || req.query?.role || null;
};

// ============================================================
// 6. GET AI INSIGHTS
// ============================================================
const getAIInsights = async (req, res) => {
  console.log(`📥 ${req.method} /ai/insights called`);
  
  try {
    const role = getRoleFromRequest(req);
    const skills = await Skill.find({ user: DEFAULT_USER });
    
    // ✅ No skills
    if (skills.length === 0) {
      return res.json({
        insight: '📝 No skills found. Add skills to get AI insights.',
        suggestedSkills: ['React', 'Node.js', 'Python', 'Docker', 'AWS'],
        missingSkills: [],
        _meta: {
          status: 'no_skills',
          message: 'Add at least 1 skill',
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ AI not available
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

    // Prepare skills
    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10)`
    ).join('\n');

    const prompt = `Analyze these skills${role ? ` for ${role}` : ''}. Return JSON:
{
  "insight": "specific, encouraging 1-2 sentence insight",
  "suggestedSkills": ["skill1", "skill2", "skill3"],
  "missingSkills": ["skill1", "skill2"]
}

SKILLS:
${skillsSummary}`;

    console.log('📤 Sending to AI...');

    const response = await callOpenRouter([
      { role: 'system', content: 'You are a career coach. Respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    
    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.error('Parse error:', e.message);
    }

    res.json({
      insight: parsed?.insight || 'Keep building your skills! 💪',
      suggestedSkills: parsed?.suggestedSkills || ['JavaScript', 'React', 'Node.js'],
      missingSkills: parsed?.missingSkills || [],
      _meta: {
        status: 'success',
        model_used: response.model || 'unknown',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ AI Insights Error:', error.message);
    res.status(500).json({
      error: 'AI service error',
      insight: `❌ ${error.message}`,
      suggestedSkills: [],
      missingSkills: [],
      _meta: {
        status: 'error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// ============================================================
// 7. GET CAREER READINESS
// ============================================================
const getCareerReadiness = async (req, res) => {
  console.log(`📥 ${req.method} /ai/readiness called`);
  
  try {
    const role = getRoleFromRequest(req);
    
    if (!role) {
      return res.status(400).json({ 
        error: 'Role is required. Use ?role=Frontend or { "role": "Frontend" }',
        _meta: {
          status: 'missing_role',
          timestamp: new Date().toISOString()
        }
      });
    }

    const skills = await Skill.find({ user: DEFAULT_USER });
    
    // ✅ No skills
    if (skills.length === 0) {
      return res.json({
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Add skills to get career analysis'],
        summary: '📝 No skills found. Add skills to get a real assessment.',
        _meta: {
          status: 'no_skills',
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ AI not available
    if (!isInitialized || !API_KEY) {
      return res.status(503).json({
        error: 'AI service unavailable',
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Set OPENROUTER_API_KEY to enable AI analysis'],
        summary: '⚠️ AI service is not configured.',
        _meta: {
          status: 'ai_unavailable',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Prepare skills
    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category || 'Uncategorized'})`
    ).join('\n');

    const prompt = `Analyze these skills for the role: ${role}. Return JSON:
{
  "score": 0-100 (be HONEST),
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2", "actionable recommendation 3"],
  "summary": "honest 1-2 sentence summary"
}

SKILLS:
${skillsSummary}

Scoring: 80+ Expert, 60-79 Strong, 40-59 Moderate, 20-39 Beginner, 0-19 Just starting`;

    console.log('📤 Sending to AI...');

    const response = await callOpenRouter([
      { role: 'system', content: 'You are a career coach. Respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    
    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.error('Parse error:', e.message);
    }

    const score = Math.min(Math.max(parsed?.score || 50, 0), 100);

    res.json({
      score: score,
      strengths: parsed?.strengths || [],
      weaknesses: parsed?.weaknesses || [],
      recommendations: parsed?.recommendations || [],
      summary: parsed?.summary || `AI analysis of your ${skills.length} skills for ${role}.`,
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
    res.status(500).json({
      error: 'AI service error',
      score: 0,
      strengths: [],
      weaknesses: [],
      recommendations: ['Please try again later'],
      summary: `❌ ${error.message}`,
      _meta: {
        status: 'error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// ============================================================
// 8. EXPORTS
// ============================================================
module.exports = {
  getAIInsights,
  getCareerReadiness
};