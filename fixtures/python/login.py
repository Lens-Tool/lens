# Authentication helpers for the sample project.
import time

TOKEN_TTL_SECONDS = 3600  # token expiry


def create_token(user_id: str) -> dict:
    """Create a session token that expires after TOKEN_TTL_SECONDS."""

    # Expiry is stored as an absolute timestamp.
    return {"user": user_id, "expires_at": time.time() + TOKEN_TTL_SECONDS}


def is_token_expired(token: dict) -> bool:
    return time.time() > token["expires_at"]


def format_username(name: str) -> str:
    # Unrelated helper: should be reducible to a signature later.
    return name.strip().lower()
