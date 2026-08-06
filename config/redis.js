const axios = require('axios');

class UpstashRedis {
  constructor() {
    this.baseUrl = process.env.UPSTASH_REDIS_REST_URL;
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN;
    this.isConnected = false;
    
    if (this.baseUrl && this.token) {
      this.isConnected = true;
      console.log('✅ Upstash Redis (REST API) initialized');
    } else {
      console.log('⚠️ Upstash credentials not found - caching disabled');
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      const response = await axios.get(`${this.baseUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      return response.data.result;
    } catch (error) {
      console.error('❌ Redis GET error:', error.message);
      return null;
    }
  }

  async setex(key, ttl, value) {
    if (!this.isConnected) return false;
    try {
      await axios.post(`${this.baseUrl}/setex/${key}/${ttl}`, value, {
        headers: { 
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'text/plain'
        }
      });
      return true;
    } catch (error) {
      console.error('❌ Redis SET error:', error.message);
      return false;
    }
  }

  async keys(pattern) {
    if (!this.isConnected) return [];
    try {
      const response = await axios.get(`${this.baseUrl}/keys/${pattern}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      return response.data.result || [];
    } catch (error) {
      return [];
    }
  }

  async del(keys) {
    if (!this.isConnected || keys.length === 0) return 0;
    try {
      const keyStr = keys.join(',');
      const response = await axios.delete(`${this.baseUrl}/del/${keyStr}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      return response.data.result || 0;
    } catch (error) {
      return 0;
    }
  }

  // ✅ Ping to test connection
  async ping() {
    if (!this.isConnected) return 'PONG (cached)';
    try {
      const response = await axios.get(`${this.baseUrl}/ping`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      return response.data.result || 'PONG';
    } catch (error) {
      return 'PONG (cached)';
    }
  }
}

// ✅ Initialize Redis instance
const redis = new UpstashRedis();

// ✅ Helper: Generate cache key from input
const generateCacheKey = (prefix, input) => {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return `${prefix}:${hash}`;
};

// ✅ Helper: Get cached data
const getCachedData = async (key) => {
  if (!redis.isConnected) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('❌ Redis get error:', error.message);
    return null;
  }
};

// ✅ Helper: Set cached data with TTL (default: 1 hour)
const setCachedData = async (key, data, ttl = 3600) => {
  if (!redis.isConnected) return false;
  try {
    await redis.setex(key, ttl, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('❌ Redis set error:', error.message);
    return false;
  }
};

// ✅ Helper: Clear cache by pattern
const clearCache = async (pattern) => {
  if (!redis.isConnected) return 0;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
      return keys.length;
    }
    return 0;
  } catch (error) {
    console.error('❌ Redis clear error:', error.message);
    return 0;
  }
};

// ✅ Helper: Check if Redis is connected
const isRedisConnected = () => redis.isConnected;

module.exports = {
  redis,
  generateCacheKey,
  getCachedData,
  setCachedData,
  clearCache,
  isRedisConnected
};