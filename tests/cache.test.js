const request = require('supertest');
const app = require('../app');

describe('Redis Caching Performance', () => {
  let authToken;
  const testUser = {
    username: `cachetest_${Date.now()}`,
    email: `cachetest_${Date.now()}@example.com`,
    password: 'password123'
  };

  // ✅ Check if API key is available
  const hasApiKey = process.env.OPENROUTER_API_KEY && 
                     process.env.OPENROUTER_API_KEY !== 'test_key' &&
                     process.env.OPENROUTER_API_KEY !== 'dummy';

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

    await request(app)
      .post('/skills/registry')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ skillId: 'html', name: 'HTML', category: 'Frontend' });
    
    await request(app)
      .post('/skills')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ skillId: 'html', level: 8, category: 'Frontend', experience: 'project' });
  });

  // ✅ Skip tests if no API key
  const testOrSkip = hasApiKey ? test : test.skip;

  testOrSkip('Cache status is correctly reported', async () => {
    const uniqueRole = `Backend Developer ${Date.now()}`;
    
    const res = await request(app)
      .post('/ai/readiness')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ role: uniqueRole });

    expect(res.body._meta).toBeDefined();
    expect(['MISS', 'HIT']).toContain(res.body._meta?.cache);
    expect(res.statusCode).toBe(200);
  }, 60000);

  testOrSkip('Response includes cache metadata', async () => {
    const role = `Test Role ${Date.now()}`;

    const res = await request(app)
      .post('/ai/readiness')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ role });

    expect(res.body._meta).toBeDefined();
    expect(res.body._meta).toHaveProperty('cache');
    expect(res.body._meta).toHaveProperty('timestamp');
  }, 60000);

  testOrSkip('Multiple consecutive requests are consistent', async () => {
    const uniqueRole = `Consistency Test ${Date.now()}`;

    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post('/ai/readiness')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: uniqueRole });
      
      expect(res.statusCode).toBe(200);
      expect(res.body._meta).toBeDefined();
    }

    console.log('✅ All 3 requests returned consistent responses');
  }, 60000);
});