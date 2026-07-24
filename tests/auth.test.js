const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

describe('Authentication', () => {
  const timestamp = Date.now();
  const testUser = {
    username: `testuser_${timestamp}`,
    email: `test_${timestamp}@example.com`,
    password: 'password123'
  };

  // ✅ Clean up before each test
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send(testUser);
      
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.user).toHaveProperty('username', testUser.username);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should return 400 for duplicate email', async () => {
      // First registration
      await request(app)
        .post('/auth/register')
        .send(testUser);

      // Second registration with same email
      const res = await request(app)
        .post('/auth/register')
        .send(testUser);
      
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for missing fields', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'test@example.com' });
      
      expect(res.statusCode).toBe(400);
    });
  });
});