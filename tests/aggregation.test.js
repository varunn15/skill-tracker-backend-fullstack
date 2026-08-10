const request = require('supertest');
const app = require('../app');

describe('MongoDB Aggregation - Dashboard Analytics', () => {
  let authToken;
  const testUser = {
    username: `agtest_${Date.now()}`,
    email: `agtest_${Date.now()}@example.com`,
    password: 'password123'
  };

  beforeAll(async () => {
    // Register user
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

    // Add a skill to registry and user
    await request(app)
      .post('/skills/registry')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ skillId: 'html', name: 'HTML', category: 'Frontend' });
    
    await request(app)
      .post('/skills')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ skillId: 'html', level: 8, category: 'Frontend', experience: 'project' });
  });

  test('GET /skills/analytics returns aggregated data', async () => {
    const res = await request(app)
      .get('/skills/analytics')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    
    const data = res.body.data;
    expect(data).toHaveProperty('totalSkills');
    expect(data).toHaveProperty('averageLevel');
    expect(data).toHaveProperty('categoryDistribution');
    expect(data).toHaveProperty('levelDistribution');
    expect(data).toHaveProperty('timeline');
    expect(data).toHaveProperty('experienceDistribution');

    console.log('\n📊 Aggregation Results:');
    console.log(`   Total Skills: ${data.totalSkills}`);
    console.log(`   Average Level: ${data.averageLevel}`);
  });
});