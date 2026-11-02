
import hashlib
import secrets
import string
import unicodedata
from datetime import datetime, timezone
from typing import Iterable, Optional

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
IDENTIFIER_PREFIXES = ("user", "session", "record", "task")


def normalize_text(value: str) -> str:
    return unicodedata.normalize("NFKC", value).strip().lower()


def generate_identifier(prefix: str = "record") -> str:
    prefix = normalize_text(prefix).replace(" ", "-")
    return f"{prefix}-{secrets.token_hex(6)}"


def calculate_checksum(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def truncate_text(value: str, limit: int = 80) -> str:
    if limit < 1:
        return ""
    return value if len(value) <= limit else value[:limit - 3].rstrip() + "..."


def paginate_items(
    items: Iterable,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> list:
    if page < 1:
        raise ValueError("Page must be greater than zero")
    if not 1 <= page_size <= MAX_PAGE_SIZE:
        raise ValueError("Invalid page size")

    start = (page - 1) * page_size
    return list(items)[start:start + page_size]


def format_timestamp(
    value: Optional[datetime] = None,
    include_seconds: bool = True,
) -> str:
    value = value or datetime.now(timezone.utc)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    pattern = "%Y-%m-%d %H:%M:%S" if include_seconds else "%Y-%m-%d %H:%M"
    return value.strftime(pattern)


def validate_identifier(value: str) -> bool:
    if not value or "-" not in value:
        return False

    prefix, random_part = value.split("-", 1)
    return (
        prefix in IDENTIFIER_PREFIXES
        and len(random_part) == 12
        and all(char in string.hexdigits for char in random_part)
    )


def unique_values(values: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(values))


def safe_integer(
    value: object,
    default: int = 0,
    minimum: Optional[int] = None,
    maximum: Optional[int] = None,
) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError):
        return default

    if minimum is not None:
        result = max(minimum, result)
    if maximum is not None:
        result = min(maximum, result)
    return result


def merge_dictionaries(
    first: dict,
    second: dict,
    overwrite: bool = True,
) -> dict:
    result = dict(first)
    for key, value in second.items():
        if overwrite or key not in result:
            result[key] = value
    return result
