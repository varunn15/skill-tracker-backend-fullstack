const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: '🚀 Skill Tracker API is running',
    endpoints: {
      skills: '/skills',
      search: '/skills/search?q=react',
      ai: '/ai/insights',
      roadmap: '/roadmap'
    }
  });
});

// ✅ SKILL ROUTES
app.use('/skills', require('./routes/skillRoutes'));
app.use('/skills', require('./routes/skillRegistryRoutes'));

// ✅ AI ROUTES
app.use('/ai', require('./routes/aiRoutes'));

// ✅ ROADMAP ROUTES - ADD THIS LINE
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
      console.log(`🗺️ Roadmap: /roadmap`); // ✅ This will appear
    });
  })
  .catch(err => console.error('❌ Error:', err));