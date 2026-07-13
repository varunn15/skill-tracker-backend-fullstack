const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  level: {
    type: String,
    default: "Beginner"
  }
});

module.exports = mongoose.model('Skill', skillSchema);