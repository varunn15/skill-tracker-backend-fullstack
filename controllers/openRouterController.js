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

// ✅ Generate strengths from actual skills
const generateStrengthsFromSkills = (skills) => {
  const highLevel = skills.filter(s => s.level >= 7);
  if (highLevel.length > 0) {
    return highLevel.slice(0, 3).map(s => `${s.skillName} (${s.level}/10)`);
  }
  const midLevel = skills.filter(s => s.level >= 4);
  if (midLevel.length > 0) {
    return midLevel.slice(0, 3).map(s => `${s.skillName} (${s.level}/10)`);
  }
  return ['Has foundational skills to build on'];
};

// ✅ Generate weaknesses from actual skills
const generateWeaknessesFromSkills = (skills) => {
  const lowLevel = skills.filter(s => s.level < 4);
  if (lowLevel.length > 0) {
    return lowLevel.slice(0, 3).map(s => `${s.skillName} (${s.level}/10) - needs improvement`);
  }
  const missingCategories = ['Backend', 'Database', 'DevOps'].filter(cat => 
    !skills.some(s => s.category && s.category.toLowerCase() === cat.toLowerCase())
  );
  if (missingCategories.length > 0) {
    return [`No experience in ${missingCategories.join(', ')}`];
  }
  return ['No major weaknesses identified'];
};

// ✅ Generate recommendations from actual skills
const generateRecommendations = (skills) => {
  const total = skills.length;
  const avgLevel = skills.reduce((sum, s) => sum + s.level, 0) / total || 0;
  const recs = [];
  if (total < 5) {
    recs.push('Add more skills to build a stronger profile');
  } else {
    recs.push('Deepen your existing skills');
  }
  if (avgLevel < 6) {
    recs.push('Focus on improving skill levels');
  } else {
    recs.push('Build complex projects');
  }
  recs.push('Create a portfolio to showcase your work');
  return recs;
};

// ✅ Generate summary from actual skills
const generateSummary = (skills, role) => {
  const total = skills.length;
  const avgLevel = skills.reduce((sum, s) => sum + s.level, 0) / total || 0;
  if (avgLevel >= 7) {
    return `You have a strong foundation in your ${total} skills for the ${role} role. Focus on mastering advanced topics.`;
  } else if (avgLevel >= 4) {
    return `You have moderate preparation with your ${total} skills for the ${role} role. Keep building and practicing.`;
  } else {
    return `You are just beginning to prepare your ${total} skills for the ${role} role. Focus on core fundamentals.`;
  }
};

const generateFallbackAnalysis = (skills, role) => {
  const total = skills.length;
  const avgLevel = skills.reduce((sum, s) => sum + s.level, 0) / total || 0;
  
  const score = Math.min(Math.max(Math.round((total * 5 + avgLevel * 5)), 10), 85);
  
  return {
    score: score,
    strengths: generateStrengthsFromSkills(skills),
    weaknesses: generateWeaknessesFromSkills(skills),
    recommendations: generateRecommendations(skills),
    summary: generateSummary(skills, role),
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

⚠️ CRITICAL RULES:
1. You MUST return at least 2 items in EACH array (strengths, weaknesses, recommendations)
2. ALWAYS reference specific skill names and levels from the user's skills
3. NEVER return empty arrays
4. Score honestly - if user has 3 basic skills, give 15-25, NOT 50

Return ONLY valid JSON:
{
  "score": number,
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "weaknesses": ["specific weakness 1", "specific weakness 2", "specific weakness 3"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2", "actionable recommendation 3"],
  "summary": "detailed 2-3 sentence summary"
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
        console.log('✅ Parsed AI response:', JSON.stringify(parsed, null, 2));
      } else {
        throw new Error('No JSON found');
      }
    } catch (e) {
      console.error('❌ Parse error:', e.message);
      console.error('📄 Raw AI response:', result); // Log the raw response for debugging
      return res.json(generateFallbackAnalysis(skills, role));
    }

    // ✅ Ensure no empty arrays
    const finalData = {
      score: Math.min(Math.max(parsed.score || 50, 10), 100),
      strengths: parsed.strengths && parsed.strengths.length > 0 
        ? parsed.strengths.slice(0, 5) 
        : generateStrengthsFromSkills(skills),
      weaknesses: parsed.weaknesses && parsed.weaknesses.length > 0 
        ? parsed.weaknesses.slice(0, 5) 
        : generateWeaknessesFromSkills(skills),
      recommendations: parsed.recommendations && parsed.recommendations.length > 0 
        ? parsed.recommendations.slice(0, 5) 
        : generateRecommendations(skills),
      summary: parsed.summary || generateSummary(skills, role)
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