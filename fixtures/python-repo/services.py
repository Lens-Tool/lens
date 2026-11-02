
from datetime import datetime, timezone
from typing import Optional

from auth import AuthenticationService
from models import User, UserProfile
from utils import generate_identifier, normalize_text, paginate_items

DEFAULT_PAGE_SIZE = 20
MAX_SEARCH_RESULTS = 50


class UserService:
    """Coordinates user account and profile operations."""

    def __init__(self, authentication: Optional[AuthenticationService] = None):
        self.authentication = authentication or AuthenticationService()
        self.profiles: dict[str, UserProfile] = {}
        self.audit_log: list[dict] = []

    def create_account(self, username: str, email: str, password: str) -> User:
        user = self.authentication.register(username, email, password)
        self.profiles[user.user_id] = UserProfile(user_id=user.user_id)
        self._record_event("account_created", user.user_id)
        return user

    def get_user(self, username: str) -> Optional[User]:
        return self.authentication.users.get(normalize_text(username))

    def update_profile(
        self,
        user_id: str,
        biography: Optional[str] = None,
        display_name: Optional[str] = None,
    ) -> bool:
        user = self._find_user_by_id(user_id)
        profile = self.profiles.get(user_id)

        if user is None or profile is None:
            return False
        if biography is not None:
            profile.update_biography(biography)
        if display_name is not None:
            user.set_display_name(display_name)

        self._record_event("profile_updated", user_id)
        return True

    def search_users(
        self,
        query: str,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> list[User]:
        query = normalize_text(query)
        if not query:
            return []

        matches = [
            user for user in self.authentication.users.values()
            if query in user.username or query in user.email
        ]
        return paginate_items(matches[:MAX_SEARCH_RESULTS], page, page_size)

    def suspend_user(self, user_id: str) -> bool:
        return self._change_status(user_id, "suspend", "account_suspended")

    def activate_user(self, user_id: str) -> bool:
        return self._change_status(user_id, "activate", "account_activated")

    def _change_status(self, user_id: str, action: str, event: str) -> bool:
        user = self._find_user_by_id(user_id)
        if user is None:
            return False

        getattr(user, action)()
        self._record_event(event, user_id)
        return True

    def list_active_users(self) -> list[User]:
        return [
            user for user in self.authentication.users.values()
            if user.is_active()
        ]

    def _find_user_by_id(self, user_id: str) -> Optional[User]:
        return next(
            (user for user in self.authentication.users.values()
             if user.user_id == user_id),
            None,
        )

    def _record_event(self, event_name: str, user_id: str) -> None:
        self.audit_log.append({
            "event_id": generate_identifier("record"),
            "event": event_name,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


class NotificationService:
    """Creates sample notifications for application users."""

    def __init__(self):
        self.notifications: list[dict] = []

    def send(
        self,
        user_id: str,
        title: str,
        message: str,
        category: str = "general",
    ) -> dict:
        notification = {
            "notification_id": generate_identifier("task"),
            "user_id": user_id,
            "title": title.strip(),
            "message": message.strip(),
            "category": category,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.notifications.append(notification)
        return notification

    def mark_as_read(self, notification_id: str) -> bool:
        for item in self.notifications:
            if item["notification_id"] == notification_id:
                item["read"] = True
                return True
        return False

    def unread_count(self, user_id: str) -> int:
        return sum(
            not item["read"] and item["user_id"] == user_id
            for item in self.notifications
        )
