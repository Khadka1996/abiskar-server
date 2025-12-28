const NodeCache = require('node-cache');

// Create a new cache instance with 1 hour TTL and check period of 120 seconds
const cache = new NodeCache({ 
  stdTTL: 3600, // 1 hour
  checkperiod: 120 
});

// Helper function to generate cache keys
const generateCacheKey = (prefix, id) => `${prefix}_${id}`;

module.exports = {
  cache,
  generateCacheKey
};