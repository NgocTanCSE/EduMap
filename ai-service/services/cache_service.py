import os
import redis
import json
from functools import wraps

class CacheService:
    def __init__(self):
        self.enabled = os.getenv("CACHE_ENABLED", "true").lower() == "true"
        self.redis_host = os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(os.getenv("REDIS_PORT", 6379))
        self.redis_client = None
        
        if self.enabled:
            hosts_to_try = [self.redis_host, "redis", "localhost", "127.0.0.1"]
            connected = False
            for host in hosts_to_try:
                try:
                    self.redis_client = redis.Redis(
                        host=host,
                        port=self.redis_port,
                        db=0,
                        decode_responses=True,
                        socket_timeout=1
                    )
                    self.redis_client.ping()
                    self.redis_host = host
                    print(f"Connected to Redis at {host}:{self.redis_port}")
                    connected = True
                    break
                except Exception:
                    continue
            
            if not connected:
                print("Redis connection failed on all common hosts. Caching disabled.")
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
