const { OpenAI } = require('openai');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// ============================================================
// 1. CHECK API KEY - HONEST ERROR IF MISSING
// ============================================================
const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
  console.error('❌ OPENROUTER_API_KEY is MISSING!');
  console.error('📝 Get your key from: https://openrouter.ai/keys');
  console.error('⚠️ AI features will NOT work without a valid key.');
}

// ============================================================
// 2. INITIALIZE OPENROUTER - FAIL CLEARLY IF NO KEY
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
    console.log('✅ OpenRouter initialized successfully with API key');
  } else {
    console.error('❌ OpenRouter NOT initialized - API key missing');
  }
} catch (error) {
  console.error('❌ OpenRouter initialization failed:', error.message);
}

// ============================================================
// 3. FREE MODELS (in order of preference)
// ============================================================
const FREE_MODELS = [
  'mistralai/mixtral-8x7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free',
];

// ============================================================
// 4. CALL AI WITH HONEST ERROR REPORTING
// ============================================================
const callOpenRouter = async (messages) => {
  // ✅ HONEST ERROR: No API key
  if (!API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set. Please add it to your environment variables.');
  }

  // ✅ HONEST ERROR: Not initialized
  if (!isInitialized) {
    throw new Error('OpenRouter failed to initialize. Check your API key.');
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
      
      console.log(`✅ Model ${model} responded successfully!`);
      return response;
      
    } catch (error) {
      console.error(`❌ Model ${model} failed:`, error.message);
      lastError = {
        model,
        message: error.message,
        status: error.status || error.response?.status,
        details: error.response?.data || error
      };
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // ✅ HONEST ERROR: All models failed with details
  const errorDetails = {
    message: 'All AI models failed',
    models: lastError ? [lastError] : [],
    timestamp: new Date().toISOString()
  };
  
  throw new Error(JSON.stringify(errorDetails));
};

// ============================================================
// 5. GET AI INSIGHTS - HONEST & TRANSPARENT
// ============================================================
const getAIInsights = async (req, res) => {
  console.log('📥 POST /ai/insights called');
  
  try {
    const { role } = req.body;
    const skills = await Skill.find({ user: DEFAULT_USER });
    
    // ✅ HONEST: No skills
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

    // ✅ HONEST: AI not available
    if (!isInitialized || !API_KEY) {
      return res.status(503).json({
        error: 'AI service unavailable',
        insight: '⚠️ OpenRouter AI is not configured. Please set OPENROUTER_API_KEY.',
        suggestedSkills: [],
        missingSkills: [],
        _meta: {
          status: 'ai_unavailable',
          message: 'API key missing or invalid',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Prepare skills for AI
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

    console.log('📤 Sending to AI...');

    // ✅ Call AI
    const response = await callOpenRouter([
      { role: 'system', content: 'You are a career coach. Respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    console.log('📥 AI Response:', result.substring(0, 200) + '...');

    // ✅ Parse JSON
    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Parse Error:', parseError.message);
      console.log('Raw response:', result);
      
      // ✅ HONEST: Send the actual error
      return res.status(500).json({
        error: 'AI response parsing failed',
        insight: '❌ AI returned invalid JSON. Please try again.',
        suggestedSkills: [],
        missingSkills: [],
        _meta: {
          status: 'parse_error',
          raw_response: result.substring(0, 500),
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ HONEST: Check if AI returned expected fields
    if (!parsed.insight && !parsed.suggestedSkills) {
      return res.status(500).json({
        error: 'AI response missing expected fields',
        insight: '❌ AI response was incomplete. Please try again.',
        suggestedSkills: [],
        missingSkills: [],
        _meta: {
          status: 'incomplete_response',
          received: Object.keys(parsed),
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ SUCCESS: Return real AI data
    res.json({
      insight: parsed.insight || 'Keep building your skills! 💪',
      suggestedSkills: parsed.suggestedSkills || [],
      missingSkills: parsed.missingSkills || [],
      _meta: {
        status: 'success',
        model_used: response.model || 'unknown',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ AI Insights Error:', error.message);
    
    // ✅ HONEST: Send the actual error
    let errorDetails = { message: error.message };
    try {
      // Try to parse JSON error from our callOpenRouter
      errorDetails = JSON.parse(error.message);
    } catch (e) {
      // If not JSON, use as is
      errorDetails = { message: error.message };
    }
    
    res.status(500).json({
      error: 'AI service error',
      insight: `❌ ${errorDetails.message || 'Unknown error'}`,
      suggestedSkills: [],
      missingSkills: [],
      _meta: {
        status: 'ai_error',
        details: errorDetails,
        timestamp: new Date().toISOString()
      }
    });
  }
};

// ============================================================
// 6. GET CAREER READINESS - HONEST & TRANSPARENT
// ============================================================
const getCareerReadiness = async (req, res) => {
  console.log('📥 POST /ai/readiness called');
  
  try {
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({ 
        error: 'Role is required',
        _meta: {
          status: 'missing_role',
          timestamp: new Date().toISOString()
        }
      });
    }

    const skills = await Skill.find({ user: DEFAULT_USER });
    
    // ✅ HONEST: No skills
    if (skills.length === 0) {
      return res.json({
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Add skills to get career analysis'],
        summary: '📝 No skills found. Add skills to get a real assessment.',
        _meta: {
          status: 'no_skills',
          message: 'Add at least 1 skill to get career readiness analysis',
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ HONEST: AI not available
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
          message: 'API key missing or invalid',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Prepare skills for AI
    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category || 'Uncategorized'})`
    ).join('\n');

    const prompt = `You are a career coach. Analyze these skills for the role: ${role}

SKILLS:
${skillsSummary}

Return ONLY valid JSON (no other text):
{
  "score": 0-100 (be HONEST - if they have 3 basic skills, give 15-25, not 50),
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific weakness 1", "specific weakness 2"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2", "actionable recommendation 3"],
  "summary": "honest 1-2 sentence summary"
}

Scoring:
- 80-100: Expert (8+ skills at level 7+)
- 60-79: Strong (5-7 skills at level 5+)
- 40-59: Moderate (3-5 skills at level 4+)
- 20-39: Beginner (1-3 skills at level 3+)
- 0-19: Just starting (0-1 relevant skills)`;

    console.log('📤 Sending to AI...');

    // ✅ Call AI
    const response = await callOpenRouter([
      { role: 'system', content: 'You are a career coach. Respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    console.log('📥 AI Response:', result.substring(0, 200) + '...');

    // ✅ Parse JSON
    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('❌ Parse Error:', parseError.message);
      console.log('Raw response:', result);
      
      return res.status(500).json({
        error: 'AI response parsing failed',
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Please try again'],
        summary: '❌ AI returned invalid JSON.',
        _meta: {
          status: 'parse_error',
          raw_response: result.substring(0, 500),
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ Validate AI response
    if (parsed.score === undefined || parsed.score === null) {
      return res.status(500).json({
        error: 'AI response missing score',
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Please try again'],
        summary: '❌ AI response was incomplete.',
        _meta: {
          status: 'incomplete_response',
          received: Object.keys(parsed),
          timestamp: new Date().toISOString()
        }
      });
    }

    // ✅ SUCCESS: Return real AI data
    const score = Math.min(Math.max(parsed.score, 0), 100);
    
    res.json({
      score: score,
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      recommendations: parsed.recommendations || [],
      summary: parsed.summary || `Based on AI analysis of your ${skills.length} skills.`,
      _meta: {
        status: 'success',
        model_used: response.model || 'unknown',
        skills_analyzed: skills.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Career Readiness Error:', error.message);
    
    let errorDetails = { message: error.message };
    try {
      errorDetails = JSON.parse(error.message);
    } catch (e) {
      errorDetails = { message: error.message };
    }
    
    res.status(500).json({
      error: 'AI service error',
      score: 0,
      strengths: [],
      weaknesses: [],
      recommendations: ['Please try again later'],
      summary: `❌ ${errorDetails.message || 'Unknown error'}`,
      _meta: {
        status: 'ai_error',
        details: errorDetails,
        timestamp: new Date().toISOString()
      }
    });
  }
};

// ============================================================
// 7. EXPORTS
// ============================================================
module.exports = {
  getAIInsights,
  getCareerReadiness
};