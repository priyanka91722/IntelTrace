import hashlib
from pathlib import Path


def sha256_file(path: str | Path, chunk_size: int = 4096) -> str:
    """SHA-256 integrity fingerprint, streamed in 4096-byte chunks."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()
