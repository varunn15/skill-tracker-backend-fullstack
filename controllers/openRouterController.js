const { OpenAI } = require('openai');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// Initialize OpenRouter
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || 'dummy-key',
  timeout: 120000,
  defaultHeaders: {
    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5000',
    'X-Title': 'Skill Tracker App',
  }
});

// ✅ CLEAN WORKING FREE MODELS ONLY
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

// ✅ SAFE CALL WITH FALLBACK (NO THROW)
const callOpenRouter = async (messages) => {
  for (const model of FREE_MODELS) {
    try {
      const response = await openrouter.chat.completions.create({
        model,
        messages,
        max_tokens: 800,
        temperature: 0.7,
      });

      console.log(`✅ Model worked: ${model}`);
      return response;

    } catch (error) {
      console.error(`❌ Model ${model} failed:`, error.message);
    }
  }

  console.error("❌ All models failed — using fallback");

  // ✅ NEVER THROW (prevents 500)
  return {
    choices: [{
      message: {
        content: JSON.stringify({
          insight: "AI unavailable, using fallback.",
          suggestedSkills: [],
          missingSkills: [],
          careerReadiness: null
        })
      }
    }]
  };
};

// ✅ SAFE JSON PARSER
const safeParse = (text, skills = []) => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) throw new Error("No JSON found");

    return JSON.parse(jsonMatch[0]);

  } catch (err) {
    console.error("❌ JSON Parse Error:", err.message);

    return {
      insight: `You have ${skills.length} skills. Keep improving! 💪`,
      suggestedSkills: ['JavaScript', 'React', 'Node.js'],
      missingSkills: ['TypeScript', 'Testing'],
      careerReadiness: null
    };
  }
};


// ===============================
// 🤖 AI INSIGHTS
// ===============================
exports.getAIInsights = async (req, res) => {
  try {
    const skills = await Skill.find({ userId: DEFAULT_USER });

    const skillNames = skills.map(s => s.name).join(', ');

    const messages = [
      {
        role: "system",
        content: "You are a helpful career assistant. Return ONLY valid JSON."
      },
      {
        role: "user",
        content: `
User skills: ${skillNames}

Return JSON:
{
  "insight": "...",
  "suggestedSkills": ["..."],
  "missingSkills": ["..."]
}
`
      }
    ];

    const response = await callOpenRouter(messages);

    const rawText = response.choices[0].message.content;

    console.log("🧠 RAW AI RESPONSE (Insights):");
    console.log(rawText);

    const parsed = safeParse(rawText, skills);

    res.json(parsed);

  } catch (error) {
    console.error("❌ AI Insights Error:", error.message);

    res.json({
      insight: "Unable to generate insights.",
      suggestedSkills: [],
      missingSkills: []
    });
  }
};


// ===============================
// 🎯 CAREER READINESS
// ===============================
exports.getCareerReadiness = async (req, res) => {
  try {
    const { role } = req.body;

    const skills = await Skill.find({ userId: DEFAULT_USER });
    const skillNames = skills.map(s => s.name).join(', ');

    const messages = [
      {
        role: "system",
        content: "Return ONLY valid JSON."
      },
      {
        role: "user",
        content: `
User skills: ${skillNames}
Target role: ${role}

Return JSON:
{
  "score": number,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "missingSkills": ["..."]
}
`
      }
    ];

    const response = await callOpenRouter(messages);

    const rawText = response.choices[0].message.content;

    console.log("🧠 RAW AI RESPONSE (Readiness):");
    console.log(rawText);

    const parsed = safeParse(rawText, skills);

    res.json(parsed);

  } catch (error) {
    console.error("❌ Career Readiness Error:", error.message);

    res.json({
      score: 50,
      strengths: [],
      weaknesses: [],
      missingSkills: []
    });
  }
};
