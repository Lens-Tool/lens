
import unittest

from auth import (
    AuthenticationError,
    AuthenticationService,
    Session,
)
from models import User


class TestAuthenticationService(unittest.TestCase):
    """Tests for the fictional authentication service."""

    def setUp(self):
        self.service = AuthenticationService()
        self.user = self.service.register(
            username="sample_user",
            email="sample@example.test",
            password="sample-password",
        )

    def test_register_creates_user(self):
        self.assertIsInstance(self.user, User)
        self.assertEqual(self.user.username, "sample_user")
        self.assertEqual(self.user.status, "active")

    def test_register_rejects_short_password(self):
        with self.assertRaises(AuthenticationError):
            self.service.register(
                "another_user",
                "another@example.test",
                "short",
            )

    def test_register_rejects_empty_username(self):
        with self.assertRaises(AuthenticationError):
            self.service.register(
                "",
                "another@example.test",
                "sample-password",
            )

    def test_register_rejects_duplicate_username(self):
        with self.assertRaises(AuthenticationError):
            self.service.register(
                "sample_user",
                "different@example.test",
                "another-password",
            )

    def test_authenticate_creates_session(self):
        session = self.service.authenticate(
            "sample_user",
            "sample-password",
        )

        self.assertIsInstance(session, Session)
        self.assertTrue(session.is_valid())
        self.assertEqual(session.user_id, self.user.user_id)

    def test_authenticate_rejects_unknown_user(self):
        with self.assertRaises(AuthenticationError):
            self.service.authenticate(
                "missing_user",
                "sample-password",
            )

    def test_authenticate_rejects_empty_password(self):
        with self.assertRaises(AuthenticationError):
            self.service.authenticate("sample_user", "")

        self.assertEqual(
            self.service.failed_attempts["sample_user"],
            1,
        )

    def test_authenticate_rejects_wrong_password(self):
        with self.assertRaises(AuthenticationError):
            self.service.authenticate(
                "sample_user",
                "wrong-password",
            )

        self.assertEqual(
            self.service.failed_attempts["sample_user"],
            1,
        )

    def test_authenticate_blocks_after_max_attempts(self):
        for _ in range(5):
            with self.assertRaises(AuthenticationError):
                self.service.authenticate(
                    "sample_user",
                    "wrong-password",
                )

        with self.assertRaises(AuthenticationError):
            self.service.authenticate(
                "sample_user",
                "sample-password",
            )

    def test_logout_invalidates_session(self):
        session = self.service.authenticate(
            "sample_user",
            "sample-password",
        )

        result = self.service.logout(session.session_id)

        self.assertTrue(result)
        self.assertFalse(session.is_valid())

    def test_logout_returns_false_for_unknown_session(self):
        self.assertFalse(self.service.logout("missing-session"))

    def test_find_session_returns_active_session(self):
        session = self.service.authenticate(
            "sample_user",
            "sample-password",
        )

        found = self.service.find_session(session.session_id)

        self.assertIs(found, session)

    def test_active_session_count(self):
        self.service.authenticate("sample_user", "sample-password")
        self.service.authenticate("sample_user", "sample-password")

        self.assertEqual(self.service.active_session_count(), 2)


class TestSession(unittest.TestCase):
    """Tests for individual session behavior."""

    def test_new_session_is_active(self):
        session = Session("sample-user-id")

        self.assertTrue(session.is_valid())

    def test_invalidated_session_is_not_valid(self):
        session = Session("sample-user-id")
        session.invalidate()

        self.assertFalse(session.is_valid())

    def test_invalidated_session_has_no_remaining_time(self):
        session = Session("sample-user-id")
        session.invalidate()

        self.assertEqual(session.remaining_seconds(), 0)


if __name__ == "__main__":
    unittest.main()
