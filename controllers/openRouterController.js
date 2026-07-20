const { OpenAI } = require('openai');
const Skill = require('../models/Skill');

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
        temperature: 0.2, // Lower temperature for more reliable JSON structure
        response_format: { type: "json_object" } // Request JSON object if supported
      });

      const text = response.choices?.[0]?.message?.content;
      if (text) {
        console.log(`✅ Model ${model} responded successfully`);
        // Clean JSON formatting if wrapped in backticks
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
// 1. GET ROLE FROM REQUEST
// ============================================================
const getRoleFromRequest = (req) => {
  return req.body?.role || req.query?.role || null;
};

// ============================================================
// 2. GET AI INSIGHTS
// ============================================================
const getAIInsights = async (req, res) => {
  console.log(`📥 ${req.method} /ai/insights called`);
  
  try {
    const role = getRoleFromRequest(req);
    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.status(400).json({
        error: 'Cannot load data',
        message: 'No skills found. Please add skills first.'
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({
        error: 'Cannot load data',
        message: 'Cannot load data. AI service is not configured.'
      });
    }

    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category || 'Uncategorized'})`
    ).join('\n');

    const prompt = `You are a professional career coach. Analyze the user's actual skills and provide custom, personalized insights based on their skill set. Do not use generic answers.

USER'S ACTUAL SKILLS:
${skillsSummary}

${role ? `TARGET ROLE: ${role}` : 'Analyze their profile and recommend target roles.'}

Analyze the strengths and gaps. Identify exactly which skills are missing or need improvements for the target role.

Return ONLY a JSON object with this structure:
{
  "insight": "A personalized, specific 2-sentence analysis about their current skills relative to the role.",
  "suggestedSkills": ["exactly 3 highly relevant skill names that they should learn next based on their profile"],
  "missingSkills": ["exactly 2-3 specific missing skills for this role"]
}`;

    const parsed = await callOpenRouter(
      'You are a career coach. Respond only with valid JSON. Never return empty arrays. Be specific to the user skills.',
      prompt
    );

    if (!parsed.insight || !parsed.suggestedSkills || !parsed.missingSkills) {
      return res.status(500).json({
        error: 'Cannot load data',
        message: 'Cannot load data. AI response structure was incomplete.'
      });
    }

    res.json({
      insight: parsed.insight,
      suggestedSkills: parsed.suggestedSkills,
      missingSkills: parsed.missingSkills,
      _meta: {
        status: 'success',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ AI Insights Error:', error.message);
    res.status(500).json({
      error: 'Cannot load data',
      message: `Cannot load data. AI service error: ${error.message}`
    });
  }
};

// ============================================================
// 3. GET CAREER READINESS
// ============================================================
const getCareerReadiness = async (req, res) => {
  console.log(`📥 ${req.method} /ai/readiness called`);
  
  try {
    const role = getRoleFromRequest(req);
    
    if (!role) {
      return res.status(400).json({ 
        error: 'Cannot load data',
        message: 'Role is required for career readiness analysis.'
      });
    }

    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.status(400).json({
        error: 'Cannot load data',
        message: 'No skills found. Please add skills first.'
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({
        error: 'Cannot load data',
        message: 'Cannot load data. AI service is not configured.'
      });
    }

    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10)`
    ).join('\n');

    const prompt = `You are a career readiness assessor. Critically evaluate the user's actual skills for the role of: ${role}

USER'S ACTUAL SKILLS:
${skillsSummary}

⚠️ ASSESSMENT INSTRUCTIONS:
1. Calculate a realistic score (10-100) based on how their actual skills compare to the requirements of the role: ${role}. If they only have a few junior/basic skills, score them realistically low (e.g. 15-30). Do not inflate scores.
2. The "strengths" array MUST refer to their actual skills (mentioning skill names and current levels).
3. The "weaknesses" array MUST list specific gaps or low levels in their current skill set for ${role}.
4. "recommendations" MUST be actionable steps for improving their skills.
5. "summary" MUST be a detailed 2-3 sentence overview tailored specifically to their situation.

Return ONLY a JSON object with this structure:
{
  "score": number,
  "strengths": ["specific strength 1 detailing skill name and level", "specific strength 2"],
  "weaknesses": ["specific weakness based on their gaps for this role", "specific weakness 2"],
  "recommendations": ["actionable advice 1", "actionable advice 2"],
  "summary": "Tailored 2-3 sentence summary"
}`;

    const parsed = await callOpenRouter(
      'You are a brutally honest career coach. Always respond with valid JSON. NEVER return empty or generic arrays. Be specific.',
      prompt
    );

    if (parsed.score === undefined || !parsed.strengths || !parsed.weaknesses || !parsed.recommendations || !parsed.summary) {
      return res.status(500).json({
        error: 'Cannot load data',
        message: 'Cannot load data. AI response structure was incomplete.'
      });
    }

    res.json({
      score: Math.min(Math.max(parsed.score || 10, 10), 100),
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      recommendations: parsed.recommendations,
      summary: parsed.summary,
      _meta: {
        status: 'success',
        skills_analyzed: skills.length,
        role: role,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Career Readiness Error:', error.message);
    res.status(500).json({
      error: 'Cannot load data',
      message: `Cannot load data. AI service error: ${error.message}`
    });
  }
};

module.exports = {
  getAIInsights,
  getCareerReadiness
};
