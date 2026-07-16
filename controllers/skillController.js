const Skill = require('../models/Skill');
const Joi = require('joi');

const skillSchemaValidation = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Skill name is required',
    'string.min': 'Skill name must be at least 2 characters',
    'string.max': 'Skill name must be less than 100 characters',
    'any.required': 'Skill name is required'
  }),
  level: Joi.string().valid('Beginner', 'Intermediate', 'Advanced', 'Expert').required().messages({
    'string.empty': 'Skill level is required',
    'any.only': 'Level must be Beginner, Intermediate, Advanced, or Expert',
    'any.required': 'Skill level is required'
  })
});

// ➕ CREATE skill
const addSkill = async (req, res, next) => {
  try {
    // ✅ Validate request body
    const { error } = skillSchemaValidation.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const skill = new Skill(req.body);
    const savedSkill = await skill.save();

    res.status(201).json(savedSkill);

  } catch (err) {
    next(err);
  }
};

// 📥 GET all skills
const getSkills = async (req, res, next) => {
  try {
    const skills = await Skill.find();
    res.json(skills);
  } catch (err) {
    next(err);
  }
};

// ✏️ UPDATE skill
const updateSkill = async (req, res, next) => {
  try {
    // ✅ Validate input
    const { error } = skillSchemaValidation.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updatedSkill = await Skill.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    // ❗ Handle invalid ID
    if (!updatedSkill) {
      return res.status(404).json({ error: "Skill not found" });
    }

    res.json(updatedSkill);

  } catch (err) {
    next(err);
  }
};

// ❌ DELETE skill
const deleteSkill = async (req, res, next) => {
  try {
    const deletedSkill = await Skill.findByIdAndDelete(req.params.id);
    
    if (!deletedSkill) {
      return res.status(404).json({ error: "Skill not found" });
    }
    
    res.json({ message: "Skill deleted successfully" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addSkill,
  getSkills,
  updateSkill,
  deleteSkill
};