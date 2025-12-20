"""
Redis cache manager for ATS Filter
Handles keyword caching with automatic expiration
"""

import os
import json
from typing import Optional, Set, List
import redis
from redis.exceptions import RedisError


class CacheManager:
    """Manages Redis caching for resume keywords"""
    
    def __init__(self):
        """Initialize Redis connection"""
        redis_url = os.getenv("REDIS_URL")
        
        if not redis_url:
            print("⚠️  REDIS_URL not set. Caching will be disabled.")
            self.redis_client = None
            self.cache_enabled = False
            return
        
        try:
            # Connect to Redis (supports both local and Upstash)
            self.redis_client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            
            # Cache TTL (Time To Live)
            self.cache_ttl = int(os.getenv("CACHE_TTL_SECONDS", "3600"))  # 1 hour default
            
            # Test connection
            self.redis_client.ping()
            self.cache_enabled = True
            print("✓ Redis connection successful")
        except RedisError as e:
            print(f"⚠️  Redis connection failed: {e}")
            print("   Continuing without cache...")
            self.redis_client = None
            self.cache_enabled = False
    
    def get_resume_keywords(self, candidate_id: str) -> Optional[Set[str]]:
        """
        Get cached resume keywords
        
        Args:
            candidate_id: UUID of candidate
            
        Returns:
            Set of keywords or None if not cached
        """
        if not self.cache_enabled:
            return None
            
        try:
            cache_key = f"resume:keywords:{candidate_id}"
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                keywords_list = json.loads(cached_data)
                return set(keywords_list)
            
            return None
            
        except (RedisError, json.JSONDecodeError) as e:
            print(f"Redis get error: {e}")
            return None  # Fail gracefully
    
    def set_resume_keywords(self, candidate_id: str, keywords: Set[str]) -> bool:
        """
        Cache resume keywords with TTL
        
        Args:
            candidate_id: UUID of candidate
            keywords: Set of extracted keywords
            
        Returns:
            True if cached successfully
        """
        if not self.cache_enabled:
            return False
            
        try:
            cache_key = f"resume:keywords:{candidate_id}"
            keywords_list = sorted(list(keywords))  # Convert to list for JSON
            
            # Store with expiration
            self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(keywords_list)
            )
            
            return True
            
        except (RedisError, TypeError) as e:
            print(f"Redis set error: {e}")
            return False
    
    def invalidate_resume_keywords(self, candidate_id: str) -> bool:
        """
        Invalidate cached keywords for a candidate
        
        Args:
            candidate_id: UUID of candidate
            
        Returns:
            True if invalidated successfully
        """
        if not self.cache_enabled:
            return False
            
        try:
            cache_key = f"resume:keywords:{candidate_id}"
            self.redis_client.delete(cache_key)
            return True
            
        except RedisError as e:
            print(f"Redis delete error: {e}")
            return False
    
    def get_cache_stats(self) -> dict:
        """Get basic cache statistics"""
        if not self.cache_enabled:
            return {
                'enabled': False,
                'keyspace_hits': 0,
                'keyspace_misses': 0,
                'connected_clients': 0
            }
            
        try:
            info = self.redis_client.info('stats')
            return {
                'enabled': True,
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'connected_clients': info.get('connected_clients', 0)
            }
        except RedisError:
            return {
                'enabled': False,
                'keyspace_hits': 0,
                'keyspace_misses': 0,
                'connected_clients': 0
            }
