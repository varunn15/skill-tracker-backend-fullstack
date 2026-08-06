const { getCachedData, setCachedData, generateCacheKey, isRedisConnected } = require('../config/redis');

/**
 * Cache middleware for OpenRouter responses
 * Checks Redis cache before hitting the controller
 */
const cacheMiddleware = (prefix, ttl = 3600) => {
  return async (req, res, next) => {
    // ✅ Skip caching if Redis is not connected
    if (!isRedisConnected()) {
      console.log('ℹ️ Redis not connected - skipping cache');
      req.isCacheHit = false;
      return next();
    }

    // ✅ Generate cache key from request body + user ID
    const cacheInput = {
      userId: req.user?.id || 'anonymous',
      body: req.body
    };
    const cacheKey = generateCacheKey(prefix, cacheInput);
    
    try {
      // ✅ Try to get cached response
      const cachedData = await getCachedData(cacheKey);
      
      if (cachedData) {
        console.log(`✅ Cache HIT for ${cacheKey.substring(0, 30)}...`);
        req.cachedData = cachedData;
        req.isCacheHit = true;
        req.cacheKey = cacheKey;
        return next();
      }
      
      console.log(`🔄 Cache MISS for ${cacheKey.substring(0, 30)}...`);
      req.isCacheHit = false;
      req.cacheKey = cacheKey;
      req.cacheTTL = ttl;
      next();
      
    } catch (error) {
      console.error('❌ Cache middleware error:', error.message);
      req.isCacheHit = false;
      next();
    }
  };
};

module.exports = cacheMiddleware;