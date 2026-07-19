const { OpenAI } = require('openai');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// ✅ Initialize OpenRouter
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 60000, // 60 seconds
  defaultHeaders: {
    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5000',
    'X-Title': 'Skill Tracker App',
  }
});

// ✅ List of FREE models on OpenRouter
const FREE_MODELS = [
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "mistralai/mixtral-8x7b-instruct",     // Best free model
  "openchat/openchat-3.5",                // Good fallback
  "google/gemini-pro",                    // Another fallback
  "meta-llama/llama-2-13b-chat:free",
  'google/gemma-2-9b-it:free',
  'google/gemma-2-2b-it:free',
  'mistralai/mistral-7b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free',
  'qwen/qwen-2.5-1.5b-instruct:free',
];

// ✅ List of PAID models (cheap)
const PAID_MODELS = [
  'anthropic/claude-3.5-haiku',
  'openai/gpt-4o-mini',
  'deepseek/deepseek-chat',
  'google/gemini-2.0-flash-lite',
];

// ✅ Try models in sequence
const callOpenRouter = async (messages, retries = FREE_MODELS.length) => {
  let lastError = null;
  
  // Try free models first
  const modelsToTry = process.env.USE_PAID_MODELS === 'true' 
    ? [...PAID_MODELS, ...FREE_MODELS] 
    : FREE_MODELS;

  for (let i = 0; i < Math.min(retries, modelsToTry.length); i++) {
    const model = modelsToTry[i];
    try {
      console.log(`🤖 Trying model: ${model} (${i + 1}/${modelsToTry.length})`);
      
      const response = await Promise.race([
        openrouter.chat.completions.create({
          model: model,
          messages: messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 45 seconds')), 45000)
        )
      ]);
      
      console.log(`✅ Model ${model} responded!`);
      return response;
      
    } catch (error) {
      console.warn(`⚠️ Model ${model} failed: ${error.message}`);
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // ✅ If all AI models fail, use fallback
  throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`);
};

// @desc    Get AI insights using OpenRouter
// @route   POST /api/ai/insights
// @access  Public
const getAIInsights = async (req, res, next) => {
  try {
    const { role } = req.body;

    // Get user's skills
    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.json({
        insight: '🚀 Start adding your skills to get personalized AI insights!',
        suggestedSkills: ['React', 'Node.js', 'Python', 'Docker', 'AWS'],
        missingSkills: [],
        careerReadiness: null,
        message: 'No skills found. Add skills to enable AI analysis.'
      });
    }

    // Format skills for AI
    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category || 'Uncategorized'})`
    ).join('\n');

    // Build prompt
    const prompt = `You are a career coach. Analyze these skills and provide insights.

SKILLS:
${skillsSummary}

${role ? `TARGET ROLE: ${role}` : 'Provide general recommendations.'}

Respond with JSON ONLY:
{
  "insight": "brief encouraging message about their skills (1-2 sentences)",
  "suggestedSkills": ["skill1", "skill2", "skill3"],
  "missingSkills": ["skill1", "skill2"],
  "careerReadiness": ${role ? `{
    "score": 0-100,
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "recommendations": ["recommendation1", "recommendation2"]
  }` : 'null'}
}`;

    // ✅ Call OpenRouter with multi-model fallback
    const response = await callOpenRouter([
      { role: 'system', content: 'You are a career coach. Always respond with valid JSON only, no other text.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    
    // Parse JSON from response
    let parsedResponse;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', result);
      // ✅ Fallback response
      return res.json({
        insight: `You have ${skills.length} skills. Keep building your expertise! 💪`,
        suggestedSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'Docker'],
        missingSkills: ['TypeScript', 'Testing', 'System Design'],
        careerReadiness: null
      });
    }

    res.json(parsedResponse);

  } catch (error) {
    console.error('AI Insights Error:', error.message);
    // ✅ Final fallback
    res.json({
      insight: `💡 You're building a great skill set! Continue learning and growing.`,
      suggestedSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'Docker'],
      missingSkills: ['TypeScript', 'Testing', 'System Design'],
      careerReadiness: null
    });
  }
};

// @desc    Get career readiness with AI - PURE AI VERSION
// @route   POST /api/ai/readiness
// @access  Public
const getCareerReadiness = async (req, res, next) => {
  try {
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.json({
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Add skills to get AI-powered career analysis'],
        summary: 'Add skills to get a personalized career readiness analysis.'
      });
    }

    // Format skills for AI with more detail
    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category || 'Uncategorized'}, Experience: ${s.experience || 'Not specified'})`
    ).join('\n');

    // ✅ Enhanced AI prompt for richer insights
    const prompt = `You are a senior career coach and technical recruiter with 10+ years of experience. Provide a detailed, honest, and actionable career readiness assessment.

USER'S SKILLS:
${skillsSummary}

TARGET ROLE: ${role}

Analyze their readiness for this role. Consider:
1. Skill relevance to the role
2. Depth of knowledge (levels)
3. Experience type (learned vs practiced vs project)
4. Industry standards for this role

Return ONLY valid JSON with NO additional text:
{
  "score": 0-100,
  "strengths": ["specific, detailed strength 1", "specific, detailed strength 2", "specific, detailed strength 3"],
  "weaknesses": ["specific, detailed weakness 1", "specific, detailed weakness 2", "specific, detailed weakness 3"],
  "recommendations": ["actionable, step-by-step recommendation 1", "actionable, step-by-step recommendation 2", "actionable, step-by-step recommendation 3", "actionable, step-by-step recommendation 4"],
  "summary": "a detailed 2-3 sentence professional summary of their readiness"
}

Scoring criteria:
- 90-100: Exceptional match - ready for senior positions
- 80-89: Strong match - ready for mid-level positions
- 70-79: Good match - some gaps but close
- 60-69: Moderate match - several gaps
- 50-59: Basic match - significant gaps
- 0-49: Needs substantial development

Be specific and reference their actual skills. If they lack key skills, mention them clearly.`;

    // ✅ Call OpenRouter with multi-model fallback
    const response = await callOpenRouter([
      { role: 'system', content: 'You are a senior career coach. Respond with valid JSON only, no other text or markdown.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    console.log('📥 AI Response:', result.substring(0, 200) + '...');

    // Parse JSON from response
    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError.message);
      console.log('📄 Raw response:', result);
      // ✅ Return error so frontend shows retry option
      return res.status(500).json({
        error: 'AI response parsing failed',
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Please try again'],
        summary: 'Unable to analyze at this moment. Please retry.'
      });
    }

    // ✅ Ensure all fields exist with AI-generated content
    const resultData = {
      score: parsed.score || 50,
      strengths: parsed.strengths || ['No strengths identified - try again'],
      weaknesses: parsed.weaknesses || ['No weaknesses identified - try again'],
      recommendations: parsed.recommendations || ['No recommendations - try again'],
      summary: parsed.summary || 'Analysis complete. Review the details above.'
    };

    console.log('✅ Career Readiness Analysis Complete');
    res.json(resultData);

  } catch (error) {
    console.error('❌ Career Readiness Error:', error.message);
    res.status(500).json({
      error: 'Failed to analyze career readiness',
      score: 0,
      strengths: [],
      weaknesses: [],
      recommendations: ['Please try again later'],
      summary: 'Unable to analyze at this moment. Please retry.'
    });
  }
};

// @desc    Check available models
// @route   GET /api/ai/models
// @access  Public
const getModels = async (req, res) => {
  try {
    const models = await openrouter.models.list();
    res.json({
      total: models.data.length,
      freeModels: FREE_MODELS,
      paidModels: PAID_MODELS,
      available: models.data.slice(0, 10)
    });
  } catch (error) {
    res.json({ error: error.message });
  }
};

module.exports = {
  getAIInsights,
  getCareerReadiness,
  getModels
};