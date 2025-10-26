"""
Caching service for Canner backend
Implements Redis-based caching with fallback to in-memory cache
"""

import json
import logging
import os
import time
from typing import Any, Optional, Dict, List
from functools import wraps
import hashlib

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logging.warning("Redis not available. Using in-memory cache fallback.")


class CacheService:
    """Unified caching service with Redis and in-memory fallback"""
    
    def __init__(self):
        self.redis_client = None
        self.memory_cache = {}
        self.cache_stats = {"hits": 0, "misses": 0, "sets": 0}
        
        # Try to connect to Redis
        if REDIS_AVAILABLE:
            try:
                redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
                self.redis_client = redis.from_url(redis_url, decode_responses=True)
                # Test connection
                self.redis_client.ping()
                logging.info("✅ Redis cache connected")
            except Exception as e:
                logging.warning(f"Redis connection failed: {e}. Using memory cache.")
                self.redis_client = None
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        try:
            if self.redis_client:
                value = self.redis_client.get(key)
                if value is not None:
                    self.cache_stats["hits"] += 1
                    return json.loads(value)
            else:
                # Memory cache fallback
                if key in self.memory_cache:
                    entry = self.memory_cache[key]
                    if entry["expires"] > time.time():
                        self.cache_stats["hits"] += 1
                        return entry["value"]
                    else:
                        del self.memory_cache[key]
            
            self.cache_stats["misses"] += 1
            return None
            
        except Exception as e:
            logging.error(f"Cache get error: {e}")
            self.cache_stats["misses"] += 1
            return None
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Set value in cache with TTL (seconds)"""
        try:
            if self.redis_client:
                serialized = json.dumps(value, default=str)
                result = self.redis_client.setex(key, ttl, serialized)
                self.cache_stats["sets"] += 1
                return result
            else:
                # Memory cache fallback
                self.memory_cache[key] = {
                    "value": value,
                    "expires": time.time() + ttl
                }
                self.cache_stats["sets"] += 1
                
                # Simple cleanup: remove expired entries if cache gets too large
                if len(self.memory_cache) > 1000:
                    self._cleanup_memory_cache()
                
                return True
                
        except Exception as e:
            logging.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            if self.redis_client:
                return bool(self.redis_client.delete(key))
            else:
                return bool(self.memory_cache.pop(key, None))
        except Exception as e:
            logging.error(f"Cache delete error: {e}")
            return False
    
    def clear(self) -> bool:
        """Clear all cache entries"""
        try:
            if self.redis_client:
                return self.redis_client.flushdb()
            else:
                self.memory_cache.clear()
                return True
        except Exception as e:
            logging.error(f"Cache clear error: {e}")
            return False
    
    def get_stats(self) -> Dict:
        """Get cache statistics"""
        total_requests = self.cache_stats["hits"] + self.cache_stats["misses"]
        hit_rate = (self.cache_stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        
        stats = {
            "backend": "redis" if self.redis_client else "memory",
            "hits": self.cache_stats["hits"],
            "misses": self.cache_stats["misses"],
            "sets": self.cache_stats["sets"],
            "hit_rate_percent": round(hit_rate, 2),
            "total_requests": total_requests
        }
        
        if self.redis_client:
            try:
                info = self.redis_client.info()
                stats["redis_info"] = {
                    "used_memory": info.get("used_memory_human"),
                    "connected_clients": info.get("connected_clients"),
                    "total_commands_processed": info.get("total_commands_processed")
                }
            except:
                pass
        else:
            stats["memory_cache_size"] = len(self.memory_cache)
        
        return stats
    
    def _cleanup_memory_cache(self):
        """Remove expired entries from memory cache"""
        current_time = time.time()
        expired_keys = [
            key for key, entry in self.memory_cache.items()
            if entry["expires"] <= current_time
        ]
        for key in expired_keys:
            del self.memory_cache[key]


# Global cache instance
cache = CacheService()


def cached(ttl: int = 3600, key_prefix: str = ""):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            key_parts = [key_prefix or func.__name__]
            
            # Add args to key (convert to strings)
            for arg in args:
                if isinstance(arg, (str, int, float, bool)):
                    key_parts.append(str(arg))
                else:
                    # For complex objects, use hash
                    key_parts.append(hashlib.md5(str(arg).encode()).hexdigest()[:8])
            
            # Add kwargs to key
            for k, v in sorted(kwargs.items()):
                key_parts.append(f"{k}:{v}")
            
            cache_key = ":".join(key_parts)
            
            # Try to get from cache
            cached_result = cache.get(cache_key)
            if cached_result is not None:
                return cached_result
            
            # Execute function and cache result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator


class ResponseCache:
    """Specialized caching for response-related operations"""
    
    def __init__(self, cache_service: CacheService):
        self.cache = cache_service
    
    def get_responses(self, search: str = "", platform: str = "", user_id: str = "default") -> Optional[List[Dict]]:
        """Get cached responses with search/filter parameters"""
        cache_key = f"responses:{user_id}:{hashlib.md5(f'{search}:{platform}'.encode()).hexdigest()}"
        return self.cache.get(cache_key)
    
    def set_responses(self, responses: List[Dict], search: str = "", platform: str = "", user_id: str = "default", ttl: int = 300):
        """Cache responses with search/filter parameters"""
        cache_key = f"responses:{user_id}:{hashlib.md5(f'{search}:{platform}'.encode()).hexdigest()}"
        return self.cache.set(cache_key, responses, ttl)
    
    def invalidate_user_responses(self, user_id: str = "default"):
        """Invalidate all cached responses for a user"""
        # This is a simplified version - in production, you'd want pattern-based deletion
        if self.cache.redis_client:
            try:
                pattern = f"responses:{user_id}:*"
                keys = self.cache.redis_client.keys(pattern)
                if keys:
                    self.cache.redis_client.delete(*keys)
                return True
            except Exception as e:
                logging.error(f"Cache invalidation error: {e}")
        
        # For memory cache, we'd need to track keys by user
        return False
    
    def cache_ai_suggestion(self, context_hash: str, suggestions: List[Dict], ttl: int = 1800):
        """Cache AI suggestions to avoid repeated API calls"""
        cache_key = f"ai_suggestions:{context_hash}"
        return self.cache.set(cache_key, suggestions, ttl)
    
    def get_ai_suggestion(self, context_hash: str) -> Optional[List[Dict]]:
        """Get cached AI suggestions"""
        cache_key = f"ai_suggestions:{context_hash}"
        return self.cache.get(cache_key)


# Global response cache instance
response_cache = ResponseCache(cache)


class RateLimiter:
    """Simple rate limiting using cache backend"""
    
    def __init__(self, cache_service: CacheService):
        self.cache = cache_service
    
    def is_allowed(self, identifier: str, limit: int, window: int) -> bool:
        """Check if request is allowed within rate limit"""
        key = f"rate_limit:{identifier}"
        
        try:
            current = self.cache.get(key)
            if current is None:
                # First request in window
                self.cache.set(key, 1, window)
                return True
            
            if current >= limit:
                return False
            
            # Increment counter (this is not atomic, but good enough for basic rate limiting)
            self.cache.set(key, current + 1, window)
            return True
            
        except Exception as e:
            logging.error(f"Rate limiting error: {e}")
            # Fail open - allow request if rate limiting fails
            return True
    
    def get_remaining(self, identifier: str, limit: int) -> int:
        """Get remaining requests in current window"""
        key = f"rate_limit:{identifier}"
        current = self.cache.get(key) or 0
        return max(0, limit - current)


# Global rate limiter instance
rate_limiter = RateLimiter(cache)