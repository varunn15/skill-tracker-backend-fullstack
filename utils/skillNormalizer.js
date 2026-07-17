/**
 * Skill Normalization Utility
 * Converts user input to standardized skill format
 */

// Normalize skill name for storage/comparison
const normalizeSkillName = (input) => {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '') // Remove special characters
    .replace(/\s+/g, ''); // Remove spaces
};

// Generate skillId from name
const generateSkillId = (name) => {
  return normalizeSkillName(name);
};

// Check if two skill names are similar (fuzzy match)
const areSkillsSimilar = (name1, name2) => {
  const normalized1 = normalizeSkillName(name1);
  const normalized2 = normalizeSkillName(name2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) return true;
  
  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  
  // Calculate similarity (Levenshtein distance)
  const distance = getLevenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = 1 - distance / maxLength;
  
  // If similarity > 0.7, consider it a match
  return similarity > 0.7;
};

// Levenshtein distance for fuzzy matching
const getLevenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i-1] === str2[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,
        matrix[i][j-1] + 1,
        matrix[i-1][j-1] + cost
      );
    }
  }
  
  return matrix[str1.length][str2.length];
};

// Generate aliases for a skill
const generateAliases = (name) => {
  const normalized = normalizeSkillName(name);
  const aliases = new Set();
  
  // Add original
  aliases.add(normalized);
  
  // Add variations
  const variations = [
    name.toLowerCase(),
    name.toLowerCase().replace(/\s/g, '-'),
    name.toLowerCase().replace(/\s/g, '_'),
    name.toLowerCase().replace(/[^a-z0-9]/g, ''),
  ];
  
  variations.forEach(v => aliases.add(v));
  
  return Array.from(aliases);
};

module.exports = {
  normalizeSkillName,
  generateSkillId,
  areSkillsSimilar,
  getLevenshteinDistance,
  generateAliases
};