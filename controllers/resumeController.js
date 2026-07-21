const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const Skill = require('../models/Skill');
const SkillRegistry = require('../models/SkillRegistry');

const DEFAULT_USER = 'default-user';

// List of skills to scan for (lowercase)
const predefinedSkills = [
  "javascript", "react", "node", "python", "sql",
  "html", "css", "mongodb", "git", "docker",
  "aws", "java", "c++", "communication", "teamwork",
  "vue", "angular", "kubernetes", "postgresql", "mysql",
  "typescript", "express", "nextjs", "tailwind"
];

// Map skill strings to official registry names, skillIds, and categories
const skillMappings = {
  "javascript": { skillId: "javascript", name: "JavaScript", category: "Frontend" },
  "react": { skillId: "react", name: "React", category: "Frontend" },
  "node": { skillId: "nodejs", name: "Node.js", category: "Backend" },
  "python": { skillId: "python", name: "Python", category: "Backend" },
  "sql": { skillId: "sql", name: "SQL", category: "Database" },
  "html": { skillId: "html", name: "HTML", category: "Frontend" },
  "css": { skillId: "css", name: "CSS", category: "Frontend" },
  "mongodb": { skillId: "mongodb", name: "MongoDB", category: "Database" },
  "git": { skillId: "git", name: "Git", category: "Other" },
  "docker": { skillId: "docker", name: "Docker", category: "DevOps" },
  "aws": { skillId: "aws", name: "AWS", category: "DevOps" },
  "java": { skillId: "java", name: "Java", category: "Backend" },
  "c++": { skillId: "cpp", name: "C++", category: "Other" },
  "communication": { skillId: "communication", name: "Communication", category: "Other" },
  "teamwork": { skillId: "teamwork", name: "Teamwork", category: "Other" },
  "vue": { skillId: "vuejs", name: "Vue.js", category: "Frontend" },
  "angular": { skillId: "angular", name: "Angular", category: "Frontend" },
  "kubernetes": { skillId: "kubernetes", name: "Kubernetes", category: "DevOps" },
  "postgresql": { skillId: "postgresql", name: "PostgreSQL", category: "Database" },
  "mysql": { skillId: "mysql", name: "MySQL", category: "Database" },
  "typescript": { skillId: "typescript", name: "TypeScript", category: "Frontend" },
  "express": { skillId: "expressjs", name: "Express.js", category: "Backend" },
  "nextjs": { skillId: "nextjs", name: "Next.js", category: "Frontend" },
  "tailwind": { skillId: "tailwindcss", name: "Tailwind CSS", category: "Frontend" }
};

const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a file' });
    }

    const { buffer, originalname, mimetype } = req.file;
    const extension = originalname.split('.').pop().toLowerCase();

    let text = '';

    if (extension === 'pdf' || mimetype === 'application/pdf') {
      const data = await pdf(buffer);
      text = data.text;
    } else if (extension === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return res.status(400).json({ 
        error: 'Unsupported file format. Please upload a PDF or DOCX file.' 
      });
    }

    if (!text) {
      return res.status(400).json({ error: 'Could not extract text from the file.' });
    }

    // Clean text
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const cleanTextLower = cleanText.toLowerCase();

    // Match skills
    const extractedSkills = [];
    predefinedSkills.forEach(skill => {
      // Quick clean check to match exact phrases or words safely
      if (cleanTextLower.includes(skill)) {
        extractedSkills.push(skill);
      }
    });

    // Remove duplicates
    const uniqueSkills = [...new Set(extractedSkills)];

    // Save matching skills to database (as distinct user Skill documents)
    const savedSkills = [];
    for (const skillKey of uniqueSkills) {
      const mapping = skillMappings[skillKey];
      if (!mapping) continue;

      // 1. Ensure SkillRegistry has this skill
      let registrySkill = await SkillRegistry.findOne({ skillId: mapping.skillId });
      if (!registrySkill) {
        registrySkill = await SkillRegistry.create({
          skillId: mapping.skillId,
          name: mapping.name,
          category: mapping.category,
          aliases: [mapping.skillId]
        });
      }

      // 2. Check if user already has this skill in their portfolio
      let existingSkill = await Skill.findOne({
        user: req.user.id,
        skillId: mapping.skillId
      });

      if (!existingSkill) {
        const userSkill = new Skill({
          user: req.user.id,
          skillId: mapping.skillId,
          skillName: mapping.name,
          level: 5, // Default level for imported skills
          category: mapping.category,
          experience: 'practiced',
          notes: 'Extracted from resume'
        });
        const saved = await userSkill.save();
        savedSkills.push(saved);
      } else {
        savedSkills.push(existingSkill);
      }
    }

    res.json({
      message: 'Skills extracted and saved successfully',
      skills: uniqueSkills.map(key => skillMappings[key].name),
      rawExtracted: uniqueSkills,
      savedSkillsCount: savedSkills.length,
      savedSkills: savedSkills
    });

  } catch (err) {
    console.error('Error in uploadResume:', err);
    res.status(500).json({ 
      error: 'Failed to process resume', 
      details: err.message 
    });
  }
};

module.exports = {
  uploadResume
};
