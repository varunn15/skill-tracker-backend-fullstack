const request = require('supertest');
const app = require('../app');

describe('Rate Limiting Tests', () => {
  const testUser = {
    username: `ratetest_${Date.now()}`,
    email: `ratetest_${Date.now()}@example.com`,
    password: 'password123'
  };

  let authToken;

  beforeAll(async () => {
    await request(app)
      .post('/auth/register')
      .send(testUser);
    
    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    authToken = loginRes.body.accessToken;
  });

  test('Auth rate limiter blocks after 5 attempts', async () => {
    const wrongCredentials = {
      email: testUser.email,
      password: 'wrongpassword'
    };

    // ✅ 5 attempts - accept 401 OR 429 (rate limiting)
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/auth/login')
        .send(wrongCredentials);
      
      console.log(`   Attempt ${i + 1}: Status ${res.statusCode}`);
      expect([401, 429]).toContain(res.statusCode);
    }

    // ✅ 6th attempt - should be 429
    const res6 = await request(app)
      .post('/auth/login')
      .send(wrongCredentials);
    
    console.log(`   Attempt 6: Status ${res6.statusCode} - RATE LIMITED!`);
    expect(res6.statusCode).toBe(429);
    expect(res6.body).toHaveProperty('error', 'Rate limit exceeded');
  }, 60000);
});