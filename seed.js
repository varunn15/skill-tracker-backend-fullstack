const mongoose = require('mongoose');
require('dotenv').config();
const SkillRegistry = require('./models/SkillRegistry');

const skills = [
  { name: 'React', category: 'Frontend', aliases: ['reactjs', 'react-js'] },
  { name: 'Vue.js', category: 'Frontend', aliases: ['vuejs', 'vue'] },
  { name: 'Angular', category: 'Frontend', aliases: ['angularjs'] },
  { name: 'Node.js', category: 'Backend', aliases: ['nodejs', 'node'] },
  { name: 'Python', category: 'Backend', aliases: ['python3'] },
  { name: 'Java', category: 'Backend', aliases: ['java8'] },
  { name: 'Docker', category: 'DevOps', aliases: ['docker'] },
  { name: 'Kubernetes', category: 'DevOps', aliases: ['k8s', 'kubernetes'] },
  { name: 'AWS', category: 'DevOps', aliases: ['amazon-web-services'] },
  { name: 'MongoDB', category: 'Database', aliases: ['mongodb', 'mongo'] },
  { name: 'PostgreSQL', category: 'Database', aliases: ['postgres', 'pg'] },
  { name: 'MySQL', category: 'Database', aliases: ['mysql'] },
  { name: 'Git', category: 'Other', aliases: ['git'] },
  { name: 'TypeScript', category: 'Frontend', aliases: ['ts', 'typescript'] },
  { name: 'Express.js', category: 'Backend', aliases: ['express', 'expressjs'] },
  { name: 'Next.js', category: 'Frontend', aliases: ['nextjs', 'next'] },
  { name: 'Tailwind CSS', category: 'Frontend', aliases: ['tailwind'] },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing
    await SkillRegistry.deleteMany({});
    console.log('🗑️ Cleared existing skills');

    // Insert skills
    for (const skill of skills) {
      const skillId = skill.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      await SkillRegistry.create({
        skillId,
        name: skill.name,
        category: skill.category,
        aliases: [skillId, ...skill.aliases]
      });
    }

    console.log(`✅ Added ${skills.length} skills to registry`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedDatabase();