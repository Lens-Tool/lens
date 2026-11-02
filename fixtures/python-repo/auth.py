
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib

from models import User
from utils import normalize_text, generate_identifier

SESSION_DURATION_MINUTES = 45
MAX_LOGIN_ATTEMPTS = 5
PASSWORD_MIN_LENGTH = 8


class AuthenticationError(Exception):
    """Raised when an authentication operation fails."""


class Session:
    """Represents a temporary authenticated user session."""

    def __init__(self, user_id: str, duration: int = SESSION_DURATION_MINUTES):
        self.session_id = generate_identifier("session")
        self.user_id = user_id
        self.created_at = datetime.now(timezone.utc)
        self.expires_at = self.created_at + timedelta(minutes=duration)
        self.active = True

    def is_valid(self) -> bool:
        return self.active and datetime.now(timezone.utc) < self.expires_at

    def invalidate(self) -> None:
        self.active = False

    def remaining_seconds(self) -> int:
        if not self.is_valid():
            return 0
        return max(0, int((self.expires_at - datetime.now(timezone.utc)).total_seconds()))


class AuthenticationService:
    """Provides sample account authentication operations."""

    def __init__(self):
        self.users: dict[str, User] = {}
        self.password_hashes: dict[str, str] = {}
        self.sessions: dict[str, Session] = {}
        self.failed_attempts: dict[str, int] = {}

    def register(self, username: str, email: str, password: str) -> User:
        clean_username = normalize_text(username)
        clean_email = normalize_text(email)

        if len(password) < PASSWORD_MIN_LENGTH:
            raise AuthenticationError("Password is too short")
        if not clean_username or not clean_email:
            raise AuthenticationError("Username and email are required")
        if clean_username in self.users:
            raise AuthenticationError("Username already exists")

        user = User(
            user_id=generate_identifier("user"),
            username=clean_username,
            email=clean_email,
        )

        self.users[clean_username] = user
        self.password_hashes[clean_username] = hashlib.sha256(
            password.encode("utf-8")
        ).hexdigest()
        self.failed_attempts[clean_username] = 0
        return user

    def authenticate(self, username: str, password: str) -> Session:
        clean_username = normalize_text(username)

        if clean_username not in self.users:
            raise AuthenticationError("Account was not found")

        attempts = self.failed_attempts.get(clean_username, 0)
        if attempts >= MAX_LOGIN_ATTEMPTS:
            raise AuthenticationError("Too many login attempts")

        password_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
        if password_hash != self.password_hashes[clean_username]:
            self.failed_attempts[clean_username] = attempts + 1
            raise AuthenticationError("Invalid password")

        self.failed_attempts[clean_username] = 0
        session = Session(self.users[clean_username].user_id)
        self.sessions[session.session_id] = session
        return session

    def logout(self, session_id: str) -> bool:
        session = self.sessions.get(session_id)
        if session is None:
            return False
        session.invalidate()
        return True

    def find_session(self, session_id: str) -> Optional[Session]:
        session = self.sessions.get(session_id)
        return session if session and session.is_valid() else None

    def active_session_count(self) -> int:
        return sum(session.is_valid() for session in self.sessions.values())
