// backend/index.js
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Skill Tracker API is running',
    endpoints: {
      skills: '/skills',
      search: '/skills/search?q=react',
      ai: '/ai/insights'
    }
  });
});

// ✅ SKILL ROUTES
app.use('/skills', require('./routes/skillRoutes'));
app.use('/skills', require('./routes/skillRegistryRoutes'));

// ✅ AI ROUTES - THIS MUST BE HERE
app.use('/ai', require('./routes/aiRoutes'));

// Add roadmap routes
app.use('/api/roadmap', require('./routes/roadmapRoutes'));

// ✅ Roadmap routes - MUST be mounted
app.use('/roadmap', require('./routes/roadmapRoutes'));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Skills: /skills`);
      console.log(`🤖 AI: /ai/insights`);
    });
  })
  .catch(err => console.error('❌ Error:', err));