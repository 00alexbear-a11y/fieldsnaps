import NodeCache from 'node-cache';
import type { Request, Response, NextFunction } from 'express';

// In-memory cache with TTL for mobile performance optimization
// Reduces database queries and speeds up API responses for field workers
const cache = new NodeCache({
  stdTTL: 60, // Default TTL: 60 seconds
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false, // Don't clone cached objects (better performance)
});

/**
 * Cache middleware for GET endpoints
 * Caches responses by user ID + endpoint path
 */
export function cacheMiddleware(ttl: number = 60) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache in development mode for easier testing
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    // Build cache key: userId + path + query params
    const userId = (req as any).user?.claims?.sub || 'anonymous';
    const cacheKey = `${userId}:${req.path}:${JSON.stringify(req.query)}`;

    // Check if cached response exists
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      console.log(`[Cache] HIT: ${cacheKey}`);
      return res.json(cachedResponse);
    }

    // Cache the response (but only successful responses)
    console.log(`[Cache] MISS: ${cacheKey}`);
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      // Only cache successful responses (status < 400)
      if (res.statusCode < 400) {
        cache.set(cacheKey, data, ttl);
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidate all cache entries for a specific user
 * Call after mutations (create/update/delete)
 */
export function invalidateUserCache(userId: string) {
  const keys = cache.keys();
  let invalidated = 0;

  keys.forEach(key => {
    if (key.startsWith(`${userId}:`)) {
      cache.del(key);
      invalidated++;
    }
  });

  if (invalidated > 0) {
    console.log(`[Cache] Invalidated ${invalidated} entries for user ${userId}`);
  }
}

/**
 * Invalidate specific cache pattern
 * Example: invalidateCachePattern(userId, '/api/projects')
 */
export function invalidateCachePattern(userId: string, pattern: string) {
  const keys = cache.keys();
  let invalidated = 0;

  keys.forEach(key => {
    if (key.startsWith(`${userId}:${pattern}`)) {
      cache.del(key);
      invalidated++;
    }
  });

  if (invalidated > 0) {
    console.log(`[Cache] Invalidated ${invalidated} entries matching ${userId}:${pattern}`);
  }
}

/**
 * Clear all cache (useful for testing)
 */
export function clearCache() {
  cache.flushAll();
  console.log('[Cache] Cleared all entries');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    keys: cache.keys().length,
    stats: cache.getStats(),
  };
}
