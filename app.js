const path = require('path');
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'mongoose' && !process.env.MONGO_URI) {
    return originalRequire.call(this, path.resolve(__dirname, './utils/mockMongoose'));
  }
  return originalRequire.apply(this, arguments);
};

const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const errorHandler = require('./middleware/errorMiddleware');
const { protect } = require('./middleware/authMiddleware');

const app = express();

app.use(cors());
app.use(express.json());

// 📝 DETAILED LOGGING MIDDLEWARE FOR TRACING ROUTING AND MIDDLEWARE ISSUES
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`\n📥 [${new Date().toISOString()}] Incoming Request: ${req.method} ${req.originalUrl || req.url}`);
  console.log(`   Headers:`, JSON.stringify(req.headers));
  if (req.body && Object.keys(req.body).length > 0) {
    const safeBody = { ...req.body };
    if (safeBody.password) safeBody.password = '********';
    console.log(`   Body:`, JSON.stringify(safeBody));
  }

  // Intercept response methods to trace output
  const originalJson = res.json;
  res.json = function (body) {
    const duration = Date.now() - start;
    console.log(`📤 [RESPONSE] ${req.method} ${req.originalUrl || req.url} - Status: ${res.statusCode} (${duration}ms)`);
    console.log(`   Response Body:`, JSON.stringify(body).slice(0, 1000));
    return originalJson.apply(this, arguments);
  };

  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - start;
    console.log(`📤 [RESPONSE-SEND] ${req.method} ${req.originalUrl || req.url} - Status: ${res.statusCode} (${duration}ms)`);
    return originalSend.apply(this, arguments);
  };

  next();
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the Skill & Career Readiness Hub API!',
    endpoints: {
      auth: {
        register: 'POST /auth/register',
        login: 'POST /auth/login',
        logout: 'POST /auth/logout',
        me: 'GET /auth/me (Protected)'
      },
      skills: 'GET/POST/DELETE /skills',
      ai: '/ai',
      roadmap: '/roadmap'
    }
  });
});

// ✅ SKILL ROUTES
app.use('/skills', require('./routes/skillRoutes'));
app.use('/skills', require('./routes/skillRegistryRoutes'));

// ✅ AI ROUTES
app.use('/ai', require('./routes/aiRoutes'));

// ✅ ROADMAP ROUTES
app.use('/roadmap', require('./routes/roadmapRoutes'));

// ✅ AUTHENTICATION ROUTES
app.use('/auth', require('./routes/authRoutes'));

// ✅ RESUME UPLOAD ROUTES
const multer = require('multer');
const { uploadResume } = require('./controllers/resumeController');
const upload = multer({ storage: multer.memoryStorage() });
app.post('/upload-resume', protect, upload.single('resume'), uploadResume);

// Error handler
app.use(errorHandler);

module.exports = app;