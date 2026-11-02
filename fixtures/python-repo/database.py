
from typing import Any, Optional

from utils import generate_identifier, normalize_text

DEFAULT_TABLE_NAME = "records"
SUPPORTED_OPERATIONS = ("insert", "update", "delete", "select")


class DatabaseError(Exception):
    """Raised when a sample database operation fails."""


class InMemoryDatabase:
    """A fictional database implemented with Python dictionaries."""

    def __init__(self):
        self.tables: dict[str, dict[str, dict[str, Any]]] = {}
        self.connected = False
        self.query_count = 0

    def connect(self) -> bool:
        self.connected = True
        return self.connected

    def disconnect(self) -> None:
        self.connected = False

    def create_table(self, table_name: str) -> None:
        self._require_connection()
        name = normalize_text(table_name)
        if not name:
            raise DatabaseError("Table name cannot be empty")
        self.tables.setdefault(name, {})

    def insert(self, table_name: str, record: dict[str, Any]) -> str:
        self._require_connection()
        record_id = generate_identifier("record")
        self._get_table(table_name)[record_id] = {
            **record,
            "id": record_id,
        }
        self.query_count += 1
        return record_id

    def find(
        self, table_name: str, record_id: str
    ) -> Optional[dict[str, Any]]:
        self._require_connection()
        self.query_count += 1
        record = self._get_table(table_name).get(record_id)
        return dict(record) if record is not None else None

    def update(
        self, table_name: str, record_id: str, changes: dict[str, Any]
    ) -> bool:
        self._require_connection()
        table = self._get_table(table_name)
        if record_id not in table:
            return False
        table[record_id].update(changes)
        self.query_count += 1
        return True

    def delete(self, table_name: str, record_id: str) -> bool:
        self._require_connection()
        table = self._get_table(table_name)
        if record_id not in table:
            return False
        del table[record_id]
        self.query_count += 1
        return True

    def select_all(self, table_name: str) -> list[dict[str, Any]]:
        self._require_connection()
        self.query_count += 1
        return [dict(record) for record in self._get_table(table_name).values()]

    def count(self, table_name: str) -> int:
        self._require_connection()
        self.query_count += 1
        return len(self._get_table(table_name))

    def _require_connection(self) -> None:
        if not self.connected:
            raise DatabaseError("Database is not connected")

    def _get_table(self, table_name: str) -> dict[str, dict[str, Any]]:
        name = normalize_text(table_name)
        if name not in self.tables:
            raise DatabaseError(f"Unknown table: {name}")
        return self.tables[name]
