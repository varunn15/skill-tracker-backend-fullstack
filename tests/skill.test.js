const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Skill = require('../models/Skill');
const SkillRegistry = require('../models/SkillRegistry');

describe('Skills API', () => {
  let authToken;

  const testUser = {
    username: `skilltester_${Date.now()}`,
    email: `skill_${Date.now()}@test.com`,
    password: 'password123'
  };

  beforeAll(async () => {
    // ✅ Clean up
    await User.deleteMany({});
    await Skill.deleteMany({});
    
    // ✅ Ensure skill exists in registry
    let registrySkill = await SkillRegistry.findOne({ skillId: 'react' });
    if (!registrySkill) {
      registrySkill = await SkillRegistry.create({
        skillId: 'react',
        name: 'React',
        category: 'Frontend',
        aliases: ['reactjs', 'react-js']
      });
    }

    // Register user
    await request(app)
      .post('/auth/register')
      .send(testUser);

    // Login to get token
    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    authToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Skill.deleteMany({});
  });

  describe('POST /skills', () => {
    it('should create a new skill with valid token', async () => {
      const res = await request(app)
        .post('/skills')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skillId: 'react',
          level: 7,
          category: 'Frontend',
          experience: 'project'
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('skillName', 'React');
      expect(res.body).toHaveProperty('level', 7);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/skills')
        .send({
          skillId: 'react',
          level: 7
        });
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /skills', () => {
    it('should return user skills with valid token', async () => {
      const res = await request(app)
        .get('/skills')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/skills');
      
      expect(res.statusCode).toBe(401);
    });
  });
});