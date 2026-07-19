const { HfInference } = require('@huggingface/inference');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// ✅ Initialize Hugging Face
const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) {
  console.warn('⚠️ HF_TOKEN not found in environment variables');
}

const hf = new HfInference(HF_TOKEN);

// ✅ List of FREE models to try (in order of preference)
const MODELS = [
  'mistralai/Mistral-7B-Instruct-v0.1',
  'meta-llama/Llama-3.2-3B-Instruct',
  'google/gemma-2-2b-it',
  'Qwen/Qwen2.5-1.5B-Instruct',
  'microsoft/Phi-3-mini-4k-instruct',
  'HuggingFaceH4/zephyr-7b-beta',
  'Intel/neural-chat-7b-v3-1',
  'tiiuae/falcon-7b-instruct',
];

// ✅ Helper function to try models one by one
const callAIModel = async (messages, retries = MODELS.length) => {
  let lastError = null;
  
  for (let i = 0; i < Math.min(retries, MODELS.length); i++) {
    const model = MODELS[i];
    try {
      console.log(`🤖 Trying model: ${model} (${i + 1}/${MODELS.length})`);
      
      const response = await hf.chatCompletion({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      });
      
      console.log(`✅ Model ${model} responded successfully!`);
      return response;
      
    } catch (error) {
      console.warn(`⚠️ Model ${model} failed: ${error.message}`);
      lastError = error;
      // Wait 1 second before trying next model
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`);
};

// @desc    Get AI insights using multiple models with fallback
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
        suggestedSkills: [],
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

Respond with JSON ONLY (no extra text):
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

    // ✅ Call AI with multi-model fallback
    const response = await callAIModel([
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
      // ✅ Fallback response if parsing fails
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
    // ✅ Final fallback - 100% manual free
    res.json({
      insight: `💡 You're building a great skill set! Continue learning and growing.`,
      suggestedSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'Docker'],
      missingSkills: ['TypeScript', 'Testing', 'System Design'],
      careerReadiness: null
    });
  }
};

// @desc    Get career readiness
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
        recommendations: ['Add skills to get analysis']
      });
    }

    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10)`
    ).join('\n');

    const prompt = `Analyze readiness for ${role} with these skills:
${skillsSummary}

Return JSON only:
{
  "score": 0-100,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommendations": ["recommendation1", "recommendation2"]
}`;

    // ✅ Use multi-model fallback
    const response = await callAIModel([
      { role: 'system', content: 'You are a career coach. Respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ]);

    const result = response.choices[0].message.content;
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return res.json(JSON.parse(jsonMatch[0]));
    }

    // ✅ Fallback
    res.json({
      score: 50,
      strengths: ['Technical foundation'],
      weaknesses: ['Needs more experience'],
      recommendations: ['Keep learning and building projects']
    });

  } catch (error) {
    console.error('Readiness Error:', error.message);
    res.json({
      score: 50,
      strengths: ['Technical foundation'],
      weaknesses: ['Needs more experience'],
      recommendations: ['Keep learning and building projects']
    });
  }
};

module.exports = {
  getAIInsights,
  getCareerReadiness
};