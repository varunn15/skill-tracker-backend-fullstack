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
      skills: '/api/skills',
      search: '/api/skills/search?q=react',
      registry: '/api/skills/registry'
    }
  });
});

// ✅ MOUNT ROUTES AT /api
app.use('/api/skills', require('./routes/skillRoutes'));
app.use('/api/skills', require('./routes/skillRegistryRoutes'));

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