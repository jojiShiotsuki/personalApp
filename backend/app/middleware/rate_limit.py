import os
import time
from collections import defaultdict
from fastapi import HTTPException, Request
from typing import Dict

class RateLimiter:
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
        self.max_requests = int(os.getenv("AI_RATE_LIMIT_REQUESTS", "50"))
        self.window = int(os.getenv("AI_RATE_LIMIT_WINDOW", "3600"))

    def check_rate_limit(self, client_id: str):
        """Check if client has exceeded rate limit"""
        now = time.time()

        # Clean old requests
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if now - req_time < self.window
        ]

        # Check limit
        if len(self.requests[client_id]) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {self.max_requests} requests per hour.",
                headers={"Retry-After": str(self.window)}
            )

        # Add current request
        self.requests[client_id].append(now)

rate_limiter = RateLimiter()
