
from datetime import datetime, timezone
from typing import Optional


DEFAULT_USER_ROLE = "member"
AVAILABLE_ROLES = ("member", "moderator", "admin")
ACCOUNT_STATUSES = ("active", "suspended", "pending")


class User:
    """Represents a fictional account in the sample application."""

    def __init__(
        self,
        user_id: str,
        username: str,
        email: str,
        role: str = DEFAULT_USER_ROLE,
    ):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.role = role
        self.status = "active"
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = self.created_at
        self.display_name: Optional[str] = None
        self.preferences: dict[str, str] = {}

    def set_display_name(self, name: str) -> None:
        """Update the public display name."""
        self.display_name = name.strip()
        self.updated_at = datetime.now(timezone.utc)

    def update_email(self, email: str) -> None:
        """Change the account email address."""
        self.email = email.strip().lower()
        self.updated_at = datetime.now(timezone.utc)

    def change_role(self, role: str) -> bool:
        """Assign a supported account role."""
        if role not in AVAILABLE_ROLES:
            return False

        self.role = role
        self.updated_at = datetime.now(timezone.utc)
        return True

    def suspend(self) -> None:
        """Suspend the account."""
        self.status = "suspended"
        self.updated_at = datetime.now(timezone.utc)

    def activate(self) -> None:
        """Activate the account."""
        self.status = "active"
        self.updated_at = datetime.now(timezone.utc)

    def is_active(self) -> bool:
        """Check whether the account can be used."""
        return self.status == "active"

    def set_preference(self, key: str, value: str) -> None:
        """Store a simple account preference."""
        self.preferences[key] = value

    def get_preference(
        self,
        key: str,
        default: Optional[str] = None,
    ) -> Optional[str]:
        """Read a preference with an optional default value."""
        return self.preferences.get(key, default)

    def to_dict(self) -> dict:
        """Convert the account into a serializable dictionary."""
        return {
            "user_id": self.user_id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "status": self.status,
            "display_name": self.display_name,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "preferences": dict(self.preferences),
        }

    def __repr__(self) -> str:
        return (
            f"User(user_id={self.user_id!r}, "
            f"username={self.username!r}, "
            f"role={self.role!r})"
        )


class UserProfile:
    """Stores optional information associated with a user."""

    def __init__(
        self,
        user_id: str,
        biography: str = "",
        timezone_name: str = "UTC",
    ):
        self.user_id = user_id
        self.biography = biography
        self.timezone_name = timezone_name
        self.avatar_path: Optional[str] = None
        self.last_seen_at: Optional[datetime] = None

    def update_biography(self, biography: str) -> None:
        self.biography = biography.strip()

    def mark_seen(self) -> None:
        self.last_seen_at = datetime.now(timezone.utc)

    def has_avatar(self) -> bool:
        return self.avatar_path is not None
