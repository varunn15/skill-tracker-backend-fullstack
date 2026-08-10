const request = require('supertest');
const app = require('../app');

describe('Skills API', () => {
  let authToken;

  const testUser = {
    username: `skilltester_${Date.now()}`,
    email: `skill_${Date.now()}@test.com`,
    password: 'password123'
  };

  beforeAll(async () => {
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

  describe('POST /skills', () => {
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
    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/skills');
      
      expect(res.statusCode).toBe(401);
    });
  });
});