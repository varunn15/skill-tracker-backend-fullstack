const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  // For now, we use a default userId
  user: {
    type: String,
    default: 'default-user',
    index: true
  },
  skillId: {
    type: String,
    required: [true, 'Skill ID is required'],
    index: true
  },
  skillName: {
    type: String,
    required: [true, 'Skill name is required'],
    trim: true
  },
  level: {
    type: Number,
    required: [true, 'Skill level is required'],
    min: 1,
    max: 10,
    default: 5
  },
  category: {
    type: String,
    enum: ['Frontend', 'Backend', 'DevOps', 'Database', 'Other'],
    default: 'Other'
  },
  experience: {
    type: String,
    enum: ['learned', 'practiced', 'project'],
    default: 'learned'
  },
  notes: {
    type: String,
    trim: true
  },
  projectLink: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for uniqueness per user
skillSchema.index({ user: 1, skillId: 1 }, { unique: true });

// Index for queries
skillSchema.index({ user: 1, category: 1 });
skillSchema.index({ user: 1, level: 1 });

module.exports = mongoose.model('Skill', skillSchema);