const { GoogleGenerativeAI } = require('@google/generative-ai');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// @desc    Get AI-powered insights
// @route   POST /api/ai/insights
// @access  Public (for now)
const getAIInsights = async (req, res, next) => {
  try {
    const { role } = req.body; // Optional: user's target role

    // Get user's skills
    const skills = await Skill.find({ user: DEFAULT_USER });
    
    if (skills.length === 0) {
      return res.json({
        insight: '🚀 Start adding your skills to get personalized AI insights!',
        suggestedSkills: ['React', 'Node.js', 'Python'],
        missingSkills: [],
        careerReadiness: null
      });
    }

    // Format skills for AI
    const skillsSummary = skills.map(s => 
      `- ${s.skillName} (Level: ${s.level}/10, Category: ${s.category}, Experience: ${s.experience})`
    ).join('\n');

    // Build prompt
    let prompt = `
You are a career coach and skill analyst. Analyze the user's skills and provide insights.

USER'S SKILLS:
${skillsSummary}

${role ? `USER'S TARGET ROLE: ${role}` : 'No specific role mentioned.'}

Please provide:
1. A brief, encouraging insight about their skill profile (2-3 sentences)
2. 3-5 suggested skills they should learn next (with brief reason)
3. If a role was mentioned, list missing skills for that role

Format your response as JSON:
{
  "insight": "string",
  "suggestedSkills": ["skill1", "skill2", "skill3"],
  "missingSkills": ["skill1", "skill2"]
}
`;

    // Call Gemini
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON from response
    let parsedResponse;
    try {
      // Find JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      // Fallback response
      parsedResponse = {
        insight: generateFallbackInsight(skills),
        suggestedSkills: generateFallbackSuggestions(skills),
        missingSkills: []
      };
    }

    // Add career readiness if role was provided
    if (role) {
      const readiness = await calculateCareerReadiness(skills, role);
      parsedResponse.careerReadiness = readiness;
    }

    res.json(parsedResponse);

  } catch (error) {
    console.error('AI Insights Error:', error);
    // Fallback response on error
    const skills = await Skill.find({ user: DEFAULT_USER });
    res.json({
      insight: generateFallbackInsight(skills),
      suggestedSkills: generateFallbackSuggestions(skills),
      missingSkills: [],
      careerReadiness: null
    });
  }
};

// @desc    Get career readiness for a role
// @route   POST /api/ai/readiness
// @access  Public
const getCareerReadiness = async (req, res, next) => {
  try {
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const skills = await Skill.find({ user: DEFAULT_USER });
    const readiness = await calculateCareerReadiness(skills, role);
    
    res.json(readiness);
  } catch (error) {
    console.error('Career Readiness Error:', error);
    next(error);
  }
};

// Helper: Calculate career readiness
const calculateCareerReadiness = async (skills, role) => {
  const skillsSummary = skills.map(s => 
    `- ${s.skillName} (Level: ${s.level}/10)`
  ).join('\n');

  const prompt = `
User has these skills:
${skillsSummary}

Target role: ${role}

Analyze their readiness. Return JSON:
{
  "score": 0-100,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommendations": ["recommendation1", "recommendation2"]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Readiness calculation error:', error);
  }

  // Fallback readiness
  return {
    score: 50,
    strengths: ['Technical skills'],
    weaknesses: ['Needs more experience'],
    recommendations: ['Keep learning and building projects']
  };
};

// Fallback functions (if AI fails)
const generateFallbackInsight = (skills) => {
  if (skills.length === 0) return 'Start adding skills to get insights! 🚀';
  if (skills.length < 3) return 'Great start! Add more skills to see patterns. 📈';
  
  const levels = skills.map(s => s.level);
  const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;
  
  if (avgLevel > 7) return '⭐ You have advanced skills! Consider mentoring others.';
  if (avgLevel > 4) return '🚀 You\'re building solid expertise. Keep pushing forward!';
  return '🌱 You\'re on the right track. Consistency is key!';
};

const generateFallbackSuggestions = (skills) => {
  const existing = skills.map(s => s.skillName.toLowerCase());
  const allSuggestions = ['React', 'Node.js', 'Python', 'Docker', 'AWS', 'TypeScript', 'MongoDB'];
  return allSuggestions.filter(s => !existing.includes(s.toLowerCase())).slice(0, 3);
};

module.exports = {
  getAIInsights,
  getCareerReadiness
};