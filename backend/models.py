"""
Database models for Canner application using PostgreSQL
"""

import json
from typing import Any, Dict, List


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
            "id": str(self.id),  # UUID to string
            "title": self.title,
            "content": self.content,
            "tags": self.tags,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @staticmethod
    def from_db_row(row: Dict[str, Any]) -> "Response":
        """Create Response from PostgreSQL database row (RealDictRow).
        
        Args:
            row: Database row from psycopg2.extras.RealDictCursor
        """
        # Handle tags - could be list (JSONB) or string (JSON text)
        tags = row["tags"] if row["tags"] is not None else []
        if isinstance(tags, str):
            tags = json.loads(tags)
            
        return Response(
            id=str(row["id"]),  # UUID to string
            title=row["title"],
            content=row["content"],
            tags=tags,
            created_at=str(row["created_at"]) if row["created_at"] else None,
            updated_at=str(row["updated_at"]) if row["updated_at"] else None,
        )
