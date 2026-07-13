const Skill = require('../models/Skill');
const Joi = require('joi');

const skillSchemaValidation = Joi.object({
  name: Joi.string().min(3),
  level: Joi.string()
});

// ➕ CREATE skill
const addSkill = async (req, res) => {
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
const updateSkill = async (req, res) => {
  try {
    // ✅ Validate input
    const { error } = skillSchemaValidation.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updatedSkill = await Skill.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
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
const deleteSkill = async (req, res) => {
  try {
    await Skill.findByIdAndDelete(req.params.id);
    res.json({ message: "Skill deleted" });
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