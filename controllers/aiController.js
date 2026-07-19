const { GoogleGenerativeAI } = require('@google/generative-ai');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// ✅ Check if API key exists
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY not found in environment variables. AI features will not work.');
}

// ✅ Initialize Gemini only if API key exists
let model = null;
try {
  if (API_KEY) {
    const genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('✅ Gemini AI initialized successfully');
  }
} catch (error) {
  console.error('❌ Failed to initialize Gemini AI:', error.message);
}

// @desc    Get AI-powered insights
// @route   POST /api/ai/insights
// @access  Public
const getAIInsights = async (req, res, next) => {
  try {
    const { role } = req.body;

    // Get user's skills
    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.json({
        insight: '🚀 Start adding your skills to get personalized AI-powered insights!',
        suggestedSkills: [],
        missingSkills: [],
        careerReadiness: null,
        message: 'No skills found. Add skills to enable AI analysis.'
      });
    }

    // ✅ Check if AI is available
    if (!model) {
      return res.status(503).json({
        error: 'AI service is not available. Please check your API key configuration.',
        insight: '🤖 AI service is currently unavailable. Please check your Gemini API key.',
        suggestedSkills: [],
        missingSkills: [],
        careerReadiness: null
      });
    }

    // Format skills for AI
    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category || 'Uncategorized'}, Experience: ${s.experience || 'Not specified'})`
    ).join('\n');

    // Build prompt for AI
    let prompt = `
You are a career coach and skill analyst. Analyze the user's skills and provide personalized, actionable insights.

USER'S SKILLS:
${skillsSummary}

${role ? `USER'S TARGET ROLE: ${role}` : 'No specific role mentioned. Provide general skill recommendations.'}

Please provide:
1. A detailed, encouraging insight about their skill profile (2-3 sentences)
2. 3-5 specific skills they should learn next (with brief reason for each)
3. If a role was mentioned, list specific missing skills for that role
4. Career readiness score (0-100) and recommendations if role is mentioned

Format your response as valid JSON:
{
  "insight": "string",
  "suggestedSkills": ["skill1", "skill2", "skill3"],
  "missingSkills": ["skill1", "skill2"],
  "careerReadiness": {
    "score": 0-100,
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "recommendations": ["recommendation1", "recommendation2"]
  }
}

Be specific, helpful, and encouraging. Base everything on the user's actual skills.
`;

    // Call Gemini AI
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON from response
    let parsedResponse;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', response);
      return res.status(500).json({
        error: 'AI response parsing failed',
        insight: 'Unable to generate insights at this moment. Please try again.',
        suggestedSkills: [],
        missingSkills: [],
        careerReadiness: null
      });
    }

    // Ensure all fields exist
    const resultData = {
      insight: parsedResponse.insight || 'Insight generated successfully!',
      suggestedSkills: parsedResponse.suggestedSkills || [],
      missingSkills: parsedResponse.missingSkills || [],
      careerReadiness: parsedResponse.careerReadiness || null
    };

    res.json(resultData);

  } catch (error) {
    console.error('AI Insights Error:', error);
    res.status(500).json({
      error: 'Failed to generate AI insights',
      insight: 'Unable to generate insights at this moment. Please try again.',
      suggestedSkills: [],
      missingSkills: [],
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

    if (!model) {
      return res.status(503).json({
        error: 'AI service is not available. Please check your API key configuration.',
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Please check your Gemini API key configuration.']
      });
    }

    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.json({
        score: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['Add skills to get career readiness analysis'],
        message: 'No skills found. Add skills to enable analysis.'
      });
    }

    // Format skills for AI
    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10)`
    ).join('\n');

    const prompt = `
User has these skills:
${skillsSummary}

Target role: ${role}

Analyze their readiness for this role. Provide a detailed assessment.

Return JSON:
{
  "score": 0-100,
  "strengths": ["specific strength1", "specific strength2"],
  "weaknesses": ["specific weakness1", "specific weakness2"],
  "recommendations": ["actionable recommendation1", "actionable recommendation2"]
}

Be specific, honest, and actionable. Base everything on the user's actual skills.
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json(parsed);
      }
    } catch (parseError) {
      console.error('Failed to parse readiness response:', response);
    }

    res.status(500).json({
      error: 'Failed to analyze career readiness',
      score: 0,
      strengths: [],
      weaknesses: [],
      recommendations: ['Please try again later']
    });

  } catch (error) {
    console.error('Career Readiness Error:', error);
    res.status(500).json({
      error: 'Failed to analyze career readiness',
      score: 0,
      strengths: [],
      weaknesses: [],
      recommendations: ['Please try again later']
    });
  }
};

module.exports = {
  getAIInsights,
  getCareerReadiness
};