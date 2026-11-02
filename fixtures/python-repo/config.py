from pathlib import Path
from typing import Any, Optional


DEFAULT_CONFIG = {
    "app_name": "SampleHub",
    "debug": False,
    "max_users": 100,
    "session_timeout": 30,
    "allowed_roles": ["admin", "editor", "viewer"],
}


class ConfigurationError(Exception):
    pass


class AppConfig:
    def __init__(self, values: Optional[dict[str, Any]] = None):
        self.values = DEFAULT_CONFIG.copy()

        if values:
            self.values.update(values)

    def get(self, key: str, default: Any = None) -> Any:
        return self.values.get(key, default)

    def set(self, key: str, value: Any) -> None:
        if not key:
            raise ConfigurationError("Configuration key cannot be empty")

        self.values[key] = value

    def validate(self) -> bool:
        max_users = self.get("max_users")
        timeout = self.get("session_timeout")

        if not isinstance(max_users, int) or max_users <= 0:
            raise ConfigurationError("max_users must be a positive integer")

        if not isinstance(timeout, int) or timeout <= 0:
            raise ConfigurationError("session_timeout must be positive")

        return True

    def all(self) -> dict[str, Any]:
        return self.values.copy()


def load_config(file_path: str) -> AppConfig:
    path = Path(file_path)

    if not path.exists():
        raise ConfigurationError(f"Configuration file not found: {path.name}")

    raise ConfigurationError("External configuration loading is not implemented")


def create_default_config() -> AppConfig:
    config = AppConfig()
    config.validate()
    return config