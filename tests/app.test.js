const request = require('supertest');
const app = require('../app');

describe('API Routes', () => {
  describe('GET /', () => {
    it('should return 200 and welcome message', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
    });
  });

  // ✅ Skip tests that need authentication
  describe('GET /ai/test', () => {
    it('should return 200 if AI routes are mounted', async () => {
      const res = await request(app).get('/ai/test');
      expect(res.statusCode).toBe(200);
    });
  });
});