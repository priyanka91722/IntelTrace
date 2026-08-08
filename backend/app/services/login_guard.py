"""In-memory failed-login lockout, keyed by username.

Not distributed — state resets per process and isn't shared across worker
processes. That's an acceptable tradeoff for a single-instance deployment and
stops casual online brute-forcing with zero new infrastructure; a real
multi-worker production deployment should back this with Redis instead.
"""
from __future__ import annotations
import time
from collections import defaultdict
from threading import Lock

MAX_ATTEMPTS = 5
WINDOW_SECONDS = 15 * 60

_failures: dict[str, list[float]] = defaultdict(list)
_lock = Lock()


def _key(username: str) -> str:
    return username.strip().lower()


def _prune(username: str, now: float) -> list[float]:
    cutoff = now - WINDOW_SECONDS
    recent = [t for t in _failures[username] if t > cutoff]
    _failures[username] = recent
    return recent


def seconds_until_unlocked(username: str) -> float:
    """0 if not locked, else how many seconds until the oldest attempt in the
    window ages out and another attempt becomes allowed."""
    now = time.time()
    key = _key(username)
    with _lock:
        recent = _prune(key, now)
        if len(recent) < MAX_ATTEMPTS:
            return 0.0
        return max(0.0, WINDOW_SECONDS - (now - recent[0]))


def record_failure(username: str) -> None:
    with _lock:
        _failures[_key(username)].append(time.time())


def record_success(username: str) -> None:
    with _lock:
        _failures.pop(_key(username), None)
