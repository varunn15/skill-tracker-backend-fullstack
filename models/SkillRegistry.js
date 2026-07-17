const mongoose = require('mongoose');

const skillRegistrySchema = new mongoose.Schema({
  skillId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  aliases: [{
    type: String,
    trim: true
  }],
  category: {
    type: String,
    enum: ['Frontend', 'Backend', 'DevOps', 'Database', 'Other'],
    default: 'Other'
  },
  description: {
    type: String,
    trim: true
  },
  popularity: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for search
skillRegistrySchema.index({ 
  name: 'text', 
  aliases: 'text' 
});

module.exports = mongoose.model('SkillRegistry', skillRegistrySchema);