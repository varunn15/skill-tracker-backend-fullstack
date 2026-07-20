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

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ SKILL ROUTES
app.use('/skills', require('./routes/skillRoutes'));
app.use('/skills', require('./routes/skillRegistryRoutes'));

// ✅ AI ROUTES - ADD THIS
app.use('/ai', require('./routes/aiRoutes'));

// ✅ ROADMAP ROUTES - ADD THIS
app.use('/roadmap', require('./routes/roadmapRoutes'));

// ✅ AUTHENTICATION ROUTES
app.use('/auth', require('./routes/authRoutes'));

// ✅ RESUME UPLOAD ROUTES
const multer = require('multer');
const { uploadResume } = require('./controllers/resumeController');
const upload = multer({ storage: multer.memoryStorage() });
app.post('/upload-resume', upload.single('resume'), uploadResume);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/skilltracker')
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Skills: /skills`);
      console.log(`🤖 AI: /ai/insights`);
      console.log(`🗺️ Roadmap: /roadmap`);
    });
  })
  .catch(err => console.error('❌ Error:', err));