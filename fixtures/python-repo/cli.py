
import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from database import InMemoryDatabase
from services import UserService

DEFAULT_DATA_FILE = "sample-data.json"


class Application:
    """Coordinates the sample command-line application."""

    def __init__(self, data_file: Optional[str] = None):
        self.data_file = Path(data_file or DEFAULT_DATA_FILE)
        self.database = InMemoryDatabase()
        self.user_service = UserService()

    def initialize(self) -> None:
        self.database.connect()
        self.database.create_table("accounts")

    def close(self) -> None:
        self.database.disconnect()

    def add_user(self, username: str, email: str, password: str) -> dict:
        user = self.user_service.create_account(username, email, password)
        record = {
            "user_id": user.user_id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        }
        self.database.insert("accounts", record)
        return record

    def list_users(self) -> list[dict]:
        return self.database.select_all("accounts")

    def export_users(self) -> int:
        records = self.list_users()
        self.data_file.write_text(
            json.dumps(records, indent=2),
            encoding="utf-8",
        )
        return len(records)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sample-manager",
        description="Manage fictional sample accounts",
    )
    parser.add_argument("--data-file", default=DEFAULT_DATA_FILE)

    commands = parser.add_subparsers(dest="command", required=True)
    add = commands.add_parser("add")
    for argument in ("username", "email", "password"):
        add.add_argument(f"--{argument}", required=True)

    commands.add_parser("list")
    commands.add_parser("export")
    return parser


def run_command(arguments: argparse.Namespace) -> int:
    app = Application(arguments.data_file)
    app.initialize()

    try:
        if arguments.command == "add":
            result = app.add_user(
                arguments.username,
                arguments.email,
                arguments.password,
            )
            print(json.dumps(result, indent=2))
        elif arguments.command == "list":
            print(json.dumps(app.list_users(), indent=2))
        elif arguments.command == "export":
            print(f"Exported {app.export_users()} sample accounts")
        else:
            return 1
        return 0
    finally:
        app.close()


def main(argv: Optional[list[str]] = None) -> int:
    arguments = build_parser().parse_args(argv)
    try:
        return run_command(arguments)
    except (ValueError, OSError) as error:
        print(f"Application error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
