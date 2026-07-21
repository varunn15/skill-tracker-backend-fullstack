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
    const skills = await Skill.find({ user: req.user.id });
    
    if (skills.length === 0) {
      return res.status(400).json({
        error: 'Cannot load data',
        message: 'No skills found. Please add skills first.'
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      console.log(`⚠️ [AI INSIGHTS] OPENROUTER_API_KEY not found. Serving custom handcrafted fallback insights for: ${role || 'General'}`);
      
      const roleStr = role || 'Fullstack Developer';
      const roleLower = roleStr.toLowerCase();
      let suggestedSkills = ["TypeScript", "Git", "Docker"];
      let missingSkills = ["TypeScript", "Docker"];
      
      if (roleLower.includes('front')) {
        suggestedSkills = ["TypeScript", "Tailwind CSS", "Next.js"];
        missingSkills = ["TypeScript", "Tailwind CSS"];
      } else if (roleLower.includes('back')) {
        suggestedSkills = ["Express.js", "MongoDB", "Docker"];
        missingSkills = ["Express.js", "Docker"];
      } else if (roleLower.includes('analyst') || roleLower.includes('data')) {
        suggestedSkills = ["Pandas", "PostgreSQL", "Tableau"];
        missingSkills = ["Pandas", "Tableau"];
      } else if (roleLower.includes('design') || roleLower.includes('ux') || roleLower.includes('ui')) {
        suggestedSkills = ["Figma Component Library", "User Prototyping", "Design Systems"];
        missingSkills = ["Figma Component Library", "Design Systems"];
      }

      const skillsListStr = skills.map(s => s.skillName).join(', ');
      
      return res.json({
        insight: `You have a promising profile with experience in ${skillsListStr || 'fundamental skills'}. Enhancing your skillset with target role tools will accelerate your readiness for a ${roleStr} position.`,
        suggestedSkills,
        missingSkills,
        _meta: {
          status: 'success',
          isFallback: true,
          timestamp: new Date().toISOString()
        }
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

    const skills = await Skill.find({ user: req.user.id });
    
    if (skills.length === 0) {
      return res.status(400).json({
        error: 'Cannot load data',
        message: 'No skills found. Please add skills first.'
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      console.log(`⚠️ [CAREER READINESS] OPENROUTER_API_KEY not found. Serving custom handcrafted fallback assessment for: ${role}`);
      
      const roleLower = role.toLowerCase();
      const userSkillNames = skills.map(s => s.skillName.toLowerCase());
      
      let matchedCount = 0;
      let targetSkills = [];
      let standardStrengths = [];
      let standardWeaknesses = [];
      let standardRecommendations = [];

      if (roleLower.includes('front')) {
        targetSkills = ["react", "html", "css", "javascript", "tailwind", "typescript", "nextjs"];
        standardStrengths = ["Strong core web skills", "Comfortable with component-driven designs"];
        standardWeaknesses = ["Needs deeper experience with state management libraries", "Missing modern build configurations or TypeScript patterns"];
        standardRecommendations = ["Complete a high-quality Next.js or React full-stack project", "Learn TypeScript syntax and integrate with existing React projects"];
      } else if (roleLower.includes('back')) {
        targetSkills = ["nodejs", "node", "expressjs", "express", "mongodb", "postgresql", "mysql", "docker", "python", "java"];
        standardStrengths = ["Capable of setting up APIs and route controllers", "Familiar with backend architectures"];
        standardWeaknesses = ["Limited exposure to scaling database schemas", "Needs containerization and cloud orchestration skills"];
        standardRecommendations = ["Containerize your Express.js service using a multi-stage Dockerfile", "Implement robust SQL relations and write complex query joins"];
      } else if (roleLower.includes('analyst') || roleLower.includes('data')) {
        targetSkills = ["python", "pandas", "sql", "postgresql", "mysql", "mongodb", "excel"];
        standardStrengths = ["Able to retrieve and filter data collections", "Comfortable with analytical fundamentals"];
        standardWeaknesses = ["Needs advanced data cleaning automation skills", "Missing structured dashboard deployment models"];
        standardRecommendations = ["Create a Python Pandas pipeline to clean messy financial datasets", "Design an interactive business dashboard using modern charting tools"];
      } else if (roleLower.includes('design') || roleLower.includes('ux') || roleLower.includes('ui')) {
        targetSkills = ["figma", "css", "html", "git"];
        standardStrengths = ["Aesthetic layout sensitivity", "Understand user flows and journeys"];
        standardWeaknesses = ["Needs to build complete reusable design systems", "Missing hands-on collaboration with developer code specifications"];
        standardRecommendations = ["Build a complete interactive component library in Figma", "Learn standard CSS/Tailwind rules to bridge design-to-development gaps"];
      } else {
        targetSkills = ["git", "typescript", "docker"];
        standardStrengths = ["Strong foundational skills and adaptive learning curve"];
        standardWeaknesses = ["Needs specialized target role toolkits"];
        standardRecommendations = ["Create deep portfolio works with tools specialized for this track"];
      }

      targetSkills.forEach(ts => {
        if (userSkillNames.some(us => us.includes(ts) || ts.includes(us))) {
          matchedCount++;
        }
      });

      // Calculate realistic score
      const baseScore = matchedCount > 0 ? 45 + (matchedCount * 8) : 25 + (skills.length * 3);
      const score = Math.min(Math.max(baseScore, 15), 95);

      const strengthResult = matchedCount > 0 
        ? [`Exhibited active proficiency in target skills (${matchedCount} matched)`].concat(standardStrengths)
        : ["Solid general tech curiosity and baseline competence"].concat(standardStrengths);

      return res.json({
        score,
        strengths: strengthResult.slice(0, 3),
        weaknesses: standardWeaknesses.slice(0, 3),
        recommendations: standardRecommendations.slice(0, 3),
        summary: `Based on your existing skills and profile, you possess a solid baseline. Learning targeted skills like ${targetSkills.slice(0, 3).join(', ')} will bridge outstanding gaps and optimize your technical career readiness.`,
        _meta: {
          status: 'success',
          isFallback: true,
          skills_analyzed: skills.length,
          role: role,
          timestamp: new Date().toISOString()
        }
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
