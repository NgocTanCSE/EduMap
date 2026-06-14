import os
import redis
import json
from functools import wraps

class CacheService:
    def __init__(self):
        self.enabled = os.getenv("CACHE_ENABLED", "true").lower() == "true"
        self.redis_host = os.getenv("REDIS_HOST", "redis")
        self.redis_port = int(os.getenv("REDIS_PORT", 6379))
        self.redis_client = None
        
        if self.enabled:
            try:
                self.redis_client = redis.Redis(
                    host=self.redis_host,
                    port=self.redis_port,
                    db=0,
                    decode_responses=True,
                    socket_timeout=2
                )
                self.redis_client.ping()
                print(f"Connected to Redis at {self.redis_host}:{self.redis_port}")
            except Exception as e:
                print(f"Redis connection failed: {e}. Caching disabled.")
                self.enabled = False

    def get(self, key):
        if not self.enabled or not self.redis_client:
            return None
        try:
            data = self.redis_client.get(key)
            return json.loads(data) if data else None
        except:
            return None

    def set(self, key, value, ttl=3600):
        if not self.enabled or not self.redis_client:
            return
        try:
            self.redis_client.setex(key, ttl, json.dumps(value))
        except:
            pass

cache_service = CacheService()
