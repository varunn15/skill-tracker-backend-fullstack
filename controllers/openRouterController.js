const { OpenAI } = require('openai');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// ✅ Initialize OpenRouter
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || 'dummy-key',
  timeout: 120000,
  defaultHeaders: {
    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5000',
    'X-Title': 'Skill Tracker App',
  }
});

// ✅ FREE models
const FREE_MODELS = [
  'mistralai/mixtral-8x7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

// ✅ Call OpenRouter
const callOpenRouter = async (messages) => {
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
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('All AI models failed');
};

// ===== GET CAREER READINESS =====
const getCareerReadiness = async (req, res) => {
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
        recommendations: ['Add skills to get career analysis'],
        summary: 'No skills found. Add skills to get a real assessment.'
      });
    }

    console.log(`📊 Analyzing ${skills.length} skills for role: ${role}`);

    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10)`
    ).join('\n');

    const prompt = `Analyze these skills for ${role}. Return ONLY JSON:
{
  "score": 0-100,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "summary": "one sentence summary"
}

SKILLS:
${skillsSummary}`;

    console.log('📤 Calling AI...');

    const response = await callOpenRouter([
      { role: 'system', content: 'You are a career coach. Respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    console.log('📥 AI Response:', result);

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      console.error('Parse error:', e.message);
    }

    if (!parsed) {
      return res.status(500).json({
        error: 'AI response parsing failed',
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Please try again'],
        summary: 'Unable to parse AI response.'
      });
    }

    res.json({
      score: Math.min(Math.max(parsed.score || 20, 0), 100),
      strengths: parsed.strengths || ['Has skills to build on'],
      weaknesses: parsed.weaknesses || ['Needs more relevant skills'],
      recommendations: parsed.recommendations || ['Keep learning and building projects'],
      summary: parsed.summary || `You have ${skills.length} skills.`
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: 'AI service error',
      score: 0,
      strengths: [],
      weaknesses: [],
      recommendations: ['Please try again later'],
      summary: 'Unable to analyze at this time.'
    });
  }
};

// ===== GET AI INSIGHTS =====
const getAIInsights = async (req, res) => {
  try {
    const { role } = req.body;
    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.json({
        insight: '🚀 Start adding your skills!',
        suggestedSkills: [],
        missingSkills: []
      });
    }

    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10)`
    ).join('\n');

    const prompt = `Analyze these skills${role ? ` for ${role}` : ''}. Return JSON:
{
  "insight": "encouraging insight",
  "suggestedSkills": ["skill1", "skill2", "skill3"],
  "missingSkills": ["skill1", "skill2"]
}

SKILLS:
${skillsSummary}`;

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

    if (!parsed) {
      return res.status(500).json({
        error: 'AI response parsing failed',
        insight: 'Unable to generate insights.',
        suggestedSkills: [],
        missingSkills: []
      });
    }

    res.json({
      insight: parsed.insight || 'Keep building your skills! 💪',
      suggestedSkills: parsed.suggestedSkills || ['JavaScript', 'React', 'Node.js'],
      missingSkills: parsed.missingSkills || []
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      error: 'AI service error',
      insight: 'Unable to generate insights.',
      suggestedSkills: [],
      missingSkills: []
    });
  }
};

module.exports = {
  getAIInsights,
  getCareerReadiness
};