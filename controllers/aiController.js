const { HfInference } = require('@huggingface/inference');
const Skill = require('../models/Skill');

const DEFAULT_USER = 'default-user';

// ✅ Initialize with timeout
const HF_TOKEN = process.env.HF_TOKEN;
if (!HF_TOKEN) {
  console.warn('⚠️ HF_TOKEN not found in environment variables');
}

const hf = new HfInference(HF_TOKEN);

// ✅ List of FREE models to try (in order of preference)
const MODELS = [
  'sentence-transformers/all-MiniLM-L6-v2',
  
  'mistralai/Mistral-7B-Instruct-v0.1',
  'meta-llama/Llama-3.2-3B-Instruct',
  'google/gemma-2-2b-it',
  'Qwen/Qwen2.5-1.5B-Instruct',
  'microsoft/Phi-3-mini-4k-instruct',
  'HuggingFaceH4/zephyr-7b-beta',
];

// ✅ Helper function with increased timeout
const callAIModel = async (messages, retries = MODELS.length) => {
  let lastError = null;
  
  for (let i = 0; i < Math.min(retries, MODELS.length); i++) {
    const model = MODELS[i];
    try {
      console.log(`🤖 Trying model: ${model} (${i + 1}/${MODELS.length})`);
      
      // ✅ Add timeout and wait for response
      const response = await Promise.race([
        hf.chatCompletion({
          model: model,
          messages: messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 45 seconds')), 45000)
        )
      ]);
      
      console.log(`✅ Model ${model} responded successfully!`);
      return response;
      
    } catch (error) {
      console.warn(`⚠️ Model ${model} failed: ${error.message}`);
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }
  }
  
  throw new Error(`All models failed. Last error: ${lastError?.message || 'Unknown error'}`);
};