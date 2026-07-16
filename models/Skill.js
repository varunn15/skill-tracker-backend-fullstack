const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Skill name is required'],
    trim: true,
    minlength: [2, 'Skill name must be at least 2 characters'],
    maxlength: [100, 'Skill name must be less than 100 characters']
  },
  level: {
    type: String,
    required: [true, 'Skill level is required'],
    enum: {
      values: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
      message: 'Level must be Beginner, Intermediate, Advanced, or Expert'
    },
    default: "Beginner"
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

module.exports = mongoose.model('Skill', skillSchema);