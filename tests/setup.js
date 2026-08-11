// tests/setup.js
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_123456';

// ✅ Force mock mode for tests
process.env.MOCK_AI = 'true';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
  console.log('🧪 Connected to in-memory MongoDB');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  console.log('🧪 In-memory MongoDB closed');
});