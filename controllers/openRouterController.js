const { OpenAI } = require('openai');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// ✅ Initialize OpenRouter
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 60000,
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
  "mistralai/mixtral-8x7b-instruct:free",
  "openchat/openchat-3.5:free",
  "google/gemini-pro:free",
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

// ✅ Try models in sequence with fallback
const callOpenRouter = async (messages, retries = FREE_MODELS.length) => {
  let lastError = null;
  
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
          max_tokens: 600,
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
  
  throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`);
};

// ===== HONEST FALLBACK FUNCTION =====
const generateHonestFallback = (skills, role) => {
  const total = skills.length;
  const avgLevel = skills.reduce((sum, s) => sum + s.level, 0) / total || 0;
  
  let score = 10;
  if (total >= 3) score += 10;
  if (total >= 5) score += 10;
  if (total >= 8) score += 10;
  if (avgLevel >= 5) score += 10;
  if (avgLevel >= 7) score += 10;
  if (avgLevel >= 9) score += 10;
  score = Math.min(score, 85);

  const strengths = [];
  if (total > 0) strengths.push(`Has ${total} skills`);
  const highLevel = skills.filter(s => s.level >= 7).map(s => s.skillName);
  if (highLevel.length > 0) strengths.push(`Advanced in: ${highLevel.slice(0, 2).join(', ')}`);
  if (avgLevel >= 5) strengths.push(`Average skill level is ${Math.round(avgLevel)}/10`);
  if (strengths.length === 0) strengths.push('Has foundational skills to build on');

  const weaknesses = [];
  if (total < 5) weaknesses.push(`Only ${total} skills - need more breadth for ${role}`);
  const lowLevel = skills.filter(s => s.level < 4).map(s => s.skillName);
  if (lowLevel.length > 0) weaknesses.push(`Need to improve: ${lowLevel.slice(0, 2).join(', ')}`);
  if (avgLevel < 5) weaknesses.push('Skills are at beginner level - need to deepen knowledge');
  if (weaknesses.length === 0) weaknesses.push('No major weaknesses identified - but always room to grow');

  const recommendations = [];
  if (total < 5) recommendations.push(`Add ${5 - total} more skills to build a stronger profile`);
  if (lowLevel.length > 0) recommendations.push(`Deepen knowledge in ${lowLevel.slice(0, 2).join(' and ')} (currently below 4/10)`);
  if (total >= 5 && avgLevel < 6) recommendations.push('Focus on mastering existing skills before adding new ones');
  if (score < 30) recommendations.push(`You're just starting out with ${role}. Focus on core fundamentals first.`);
  if (recommendations.length === 0) {
    recommendations.push('Continue building projects to reinforce your skills');
    recommendations.push('Consider contributing to open source');
  }

  let summary = '';
  if (score >= 70) summary = `You have ${total} skills averaging ${Math.round(avgLevel)}/10. You're well prepared for ${role}! 🎯`;
  else if (score >= 50) summary = `You have ${total} skills averaging ${Math.round(avgLevel)}/10. You're on the right track for ${role}.`;
  else if (score >= 30) summary = `You have ${total} skills averaging ${Math.round(avgLevel)}/10. You're building a foundation for ${role}.`;
  else summary = `You have ${total} skills but you're just starting out with ${role}. Focus on learning core skills.`;

  return {
    score: Math.max(score, 5),
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    recommendations: recommendations.slice(0, 5),
    summary
  };
};

// ===== GET AI INSIGHTS =====
const getAIInsights = async (req, res, next) => {
  try {
    const { role } = req.body;
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

    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category || 'Uncategorized'})`
    ).join('\n');

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

    let response;
    try {
      response = await callOpenRouter([
        { role: 'system', content: 'You are a career coach. Always respond with valid JSON only, no other text.' },
        { role: 'user', content: prompt }
      ]);
    } catch (aiError) {
      console.error('❌ AI Error:', aiError.message);
      return res.json({
        insight: `You have ${skills.length} skills. Keep building your expertise! 💪`,
        suggestedSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'Docker'],
        missingSkills: ['TypeScript', 'Testing', 'System Design'],
        careerReadiness: null
      });
    }

    const result = response.choices[0].message.content;
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
    res.json({
      insight: '💡 You\'re building a great skill set! Continue learning and growing.',
      suggestedSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'Docker'],
      missingSkills: ['TypeScript', 'Testing', 'System Design'],
      careerReadiness: null
    });
  }
};

// ===== GET CAREER READINESS - PURE AI =====
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
        recommendations: ['Add skills to get an honest AI-powered career analysis'],
        summary: 'No skills found. Add skills to get a real assessment.'
      });
    }

    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category || 'Uncategorized'}, Experience: ${s.experience || 'Not specified'})`
    ).join('\n');

    const prompt = `You are a brutally honest senior career coach with 15+ years of experience. Analyze these skills for the role: ${role}

USER'S SKILLS:
${skillsSummary}

Provide a REALISTIC, HONEST assessment. Do NOT inflate scores. A beginner should get a low score.

Return ONLY valid JSON (no other text):
{
  "score": 0-100 (be honest - if they have only 3 basic skills, give 15-25, not 50),
  "strengths": ["specific, honest strength 1", "specific, honest strength 2", "specific, honest strength 3"],
  "weaknesses": ["specific, honest weakness 1", "specific, honest weakness 2", "specific, honest weakness 3"],
  "recommendations": ["actionable, step-by-step recommendation 1", "actionable, step-by-step recommendation 2", "actionable, step-by-step recommendation 3", "actionable, step-by-step recommendation 4"],
  "summary": "an honest 2-3 sentence summary of their readiness"
}

Scoring guidelines (be strict):
- 80-100: Exceptional match - ready for senior positions (requires 8+ relevant skills at level 7+)
- 60-79: Good match - ready for mid-level positions (requires 5-7 relevant skills at level 5+)
- 40-59: Moderate match - some gaps (requires 3-5 relevant skills)
- 20-39: Basic match - significant gaps (requires 1-3 relevant skills)
- 0-19: Needs substantial development (0-1 relevant skills or all low level)

Be specific and reference their actual skills. If they lack key skills, mention them clearly.
Be encouraging but honest. Don't give false hope.`;

    console.log('📤 Sending to AI:', prompt.substring(0, 300) + '...');

    let response;
    try {
      response = await callOpenRouter([
        { 
          role: 'system', 
          content: 'You are a brutally honest career coach. Never inflate scores. Always respond with valid JSON only, no other text.' 
        },
        { role: 'user', content: prompt }
      ]);
    } catch (aiError) {
      console.error('❌ AI Error:', aiError.message);
      return res.json(generateHonestFallback(skills, role));
    }

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
    } catch (parseError) {
      console.error('❌ Parse Error:', parseError.message);
      return res.json(generateHonestFallback(skills, role));
    }

    res.json({
      score: Math.min(Math.max(parsed.score || 20, 0), 100),
      strengths: parsed.strengths || ['Has skills to build on'],
      weaknesses: parsed.weaknesses || ['Needs more relevant skills'],
      recommendations: parsed.recommendations || ['Keep learning and building projects'],
      summary: parsed.summary || `You have ${skills.length} skills. Focus on building relevant skills for ${role}.`
    });

  } catch (error) {
    console.error('❌ Career Readiness Error:', error.message);
    const skills = await Skill.find({ user: DEFAULT_USER });
    res.json(generateHonestFallback(skills, req.body.role || 'your role'));
  }
};

// ===== EXPORTS =====
module.exports = {
  getAIInsights,
  getCareerReadiness
};