const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Skill Tracker API is running',
    endpoints: {
      skills: '/api/skills',        // This is just informational
      search: '/api/skills/search?q=react',
      registry: '/api/skills/registry'
    }
  });
});

// ✅ FIX: Mount routes at /api/skills
// This means the full URL will be:
// https://your-backend.onrender.com/api/skills
app.use('/skills', require('./routes/skillRoutes'));
app.use('/skills', require('./routes/skillRegistryRoutes'));
// Add AI routes
app.use('/api/ai', require('./routes/aiRoutes'));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}/api/skills`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });