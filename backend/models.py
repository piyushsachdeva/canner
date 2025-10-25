"""
Database models and initialization for Response Saver
"""

import json
import sqlite3
from typing import Any, Dict, List

DATABASE = "responses.db"


class Response:
    """Model representing a saved response."""

    def __init__(
        self,
        id: str,
        title: str,
        content: str,
        tags: List[str] = None,
        created_at: str = None,
        updated_at: str = None,
    ):
        self.id = id
        self.title = title
        self.content = content
        self.tags = tags or []
        self.created_at = created_at
        self.updated_at = updated_at

    def to_dict(self) -> Dict[str, Any]:
        """Convert response to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "tags": self.tags,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @staticmethod
    def from_db_row(row: sqlite3.Row) -> "Response":
        """Create Response from database row."""
        return Response(
            id=row["id"],
            title=row["title"],
            content=row["content"],
            tags=json.loads(row["tags"]) if row["tags"] else [],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )