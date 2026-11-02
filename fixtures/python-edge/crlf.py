from typing import Optional


class WindowsPath:
    def __init__(self, drive: str, path: str):
        self.drive = drive
        self.path = path

    def full_path(self) -> str:
        return f"{self.drive}:\\{self.path}"


def normalize_path(
    path: str,
    separator: str = "\\",
    fallback: Optional[str] = None,
) -> str:
    if not path:
        return fallback or ""

    return path.replace("/", separator)


def get_platform_name() -> str:
    return "Windows"