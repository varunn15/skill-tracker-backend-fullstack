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

// ✅ Stable free models
const FREE_MODELS = [
  "mistralai/mistral-7b-instruct:free",
  "google/gemma-2-9b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "microsoft/phi-3-mini-128k-instruct:free"
];

// ✅ Safe AI call with fallback
const callOpenRouter = async (messages) => {
  for (const model of FREE_MODELS) {
    try {
      const response = await openrouter.chat.completions.create({
        model,
        messages,
        max_tokens: 800,
        temperature: 0.3, // ✅ more stable JSON
      });

      console.log(`✅ Model worked: ${model}`);
      return response;

    } catch (error) {
      console.error(`❌ Model ${model} failed:`, error.message);
    }
  }

  console.error("❌ All models failed — using fallback");

  return {
    choices: [{
      message: {
        content: JSON.stringify({
          score: 50,
          strengths: ["Basic understanding of frontend"],
          improvements: ["Build more real-world projects"],
          recommendations: ["Learn TypeScript", "Practice system design"]
        })
      }
    }]
  };
};

// ✅ SAFE PARSER (FIXED)
const safeParse = (text, skills = [], type = "insights") => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    return JSON.parse(jsonMatch[0]);

  } catch (err) {
    console.error("❌ JSON Parse Error:", err.message);
    console.log("⚠️ RAW TEXT:", text);

    // ✅ READINESS FALLBACK (FIXED STRUCTURE)
    if (type === "readiness") {
      return {
        score: 50,
        strengths: ["You have a basic skill foundation"],
        improvements: ["Work on advanced frontend concepts"],
        recommendations: ["Learn TypeScript", "Build projects", "Learn testing"]
      };
    }

    // Insights fallback
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
        content: "Return ONLY valid JSON."
      },
      {
        role: "user",
        content: `
User skills: ${skillNames}

Return ONLY JSON:
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

    console.log("🧠 RAW AI RESPONSE (Insights):", rawText);

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
// 🎯 CAREER READINESS (FIXED)
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

Return ONLY valid JSON. No explanation.

{
  "score": number (0-100),
  "strengths": ["short points"],
  "improvements": ["short points"],
  "recommendations": ["specific actions or skills"]
}
`
      }
    ];

    const response = await callOpenRouter(messages);
    const rawText = response.choices[0].message.content;

    console.log("🧠 RAW AI RESPONSE (Readiness):", rawText);

    const parsed = safeParse(rawText, skills, "readiness");

    // ✅ FINAL CLEAN RESPONSE (MATCHES FRONTEND)
    res.json({
      score: parsed.score || 0,
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      recommendations: parsed.recommendations || []
    });

  } catch (error) {
    console.error("❌ Career Readiness Error:", error.message);

    res.json({
      score: 50,
      strengths: [],
      improvements: [],
      recommendations: []
    });
  }
};