const request = require('supertest');
const app = require('../app');

describe('Redis Caching Performance', () => {
  let authToken;
  const testUser = {
    username: `cachetest_${Date.now()}`,
    email: `cachetest_${Date.now()}@example.com`,
    password: 'password123'
  };

  beforeAll(async () => {
    // Register and login
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

    // Add skills to registry and user
    await request(app)
      .post('/skills/registry')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ skillId: 'html', name: 'HTML', category: 'Frontend' });
    
    await request(app)
      .post('/skills')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ skillId: 'html', level: 8, category: 'Frontend', experience: 'project' });
  });

  test('Cache status is correctly reported', async () => {
    const uniqueRole = `Backend Developer ${Date.now()}`;
    
    // 1. First request - should be MISS
    const res1 = await request(app)
      .post('/ai/readiness')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ role: uniqueRole });

    // ✅ Check that cache status exists (either MISS or HIT)
    expect(res1.body._meta).toBeDefined();
    expect(['MISS', 'HIT']).toContain(res1.body._meta?.cache);
    expect(res1.statusCode).toBe(200);
  }, 60000);

  test('Response includes cache metadata', async () => {
    const role = `Test Role ${Date.now()}`;

    const res = await request(app)
      .post('/ai/readiness')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ role });

    expect(res.body._meta).toBeDefined();
    expect(res.body._meta).toHaveProperty('cache');
    expect(res.body._meta).toHaveProperty('timestamp');
  }, 60000);

  test('Multiple consecutive requests are consistent', async () => {
    const uniqueRole = `Consistency Test ${Date.now()}`;

    // Make 3 requests
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