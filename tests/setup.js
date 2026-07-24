// tests/setup.js
require('dotenv').config({ path: '.env.test' });

const mongoose = require('mongoose');

jest.setTimeout(60000);

beforeAll(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI not found in .env.test');
  }
  
  await mongoose.connect(uri, {
    maxPoolSize: 10,
  });
  console.log('🧪 Connected to Atlas test database');
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    // ✅ Instead of dropDatabase, just delete all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
    await mongoose.connection.close();
    console.log('🧪 Test database cleaned and connection closed');
  }
});