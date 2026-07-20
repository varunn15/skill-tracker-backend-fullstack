const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null }
});

const phaseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  duration: { type: String, default: '1-2 weeks' },
  phase: { type: String, default: 'Phase 1' },
  skills: [{ type: String, trim: true }],
  tasks: [taskSchema],
  projects: [{ type: String, trim: true }]
});

const roadmapSchema = new mongoose.Schema({
  userId: { type: String, default: 'default-user', index: true },
  role: { type: String, required: true, trim: true },
  levels: [phaseSchema],
  totalWeeks: { type: Number, default: 0 },
  totalTasks: { type: Number, default: 0 },
  completedTasks: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

roadmapSchema.index({ userId: 1, createdAt: -1 });
roadmapSchema.index({ userId: 1, isActive: 1 });

roadmapSchema.methods.calculateProgress = function() {
  let totalTasks = 0;
  let completedTasks = 0;
  this.levels.forEach(phase => {
    phase.tasks.forEach(task => {
      totalTasks++;
      if (task.completed) completedTasks++;
    });
  });
  this.totalTasks = totalTasks;
  this.completedTasks = completedTasks;
  this.progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  return this.progress;
};

module.exports = mongoose.model('Roadmap', roadmapSchema);