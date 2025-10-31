"""
Database service for managing responses using PostgreSQL
"""

import json
import logging
import os
from typing import List, Optional

import psycopg2
import psycopg2.extras

from models import Response


class DatabaseService:
    """Service for database operations with PostgreSQL."""

    @staticmethod
    def get_connection(max_retries: int = 5, base_delay: float = 1.0):
        """Get PostgreSQL database connection with retry logic.
        
        Args:
            max_retries: Maximum number of connection attempts
            base_delay: Base delay between retries (exponential backoff)
        """
        db_url = os.getenv("DATABASE_URL", "postgresql://developer:devpassword@postgres:5432/canner_dev")
        
        for attempt in range(max_retries + 1):
            try:
                conn = psycopg2.connect(db_url)
                conn.autocommit = True
                
                # Test the connection
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.close()
                
                if attempt > 0:
                    logging.info(f"✅ PostgreSQL connection established after {attempt} retries")
                return conn
                
            except (psycopg2.OperationalError, psycopg2.DatabaseError) as e:
                if attempt == max_retries:
                    logging.error(f"❌ Failed to connect to PostgreSQL after {max_retries} attempts: {e}")
                    raise
                
                delay = base_delay * (2 ** attempt)  # Exponential backoff
                logging.warning(f"⚠️  PostgreSQL connection attempt {attempt + 1} failed, retrying in {delay}s: {e}")
                import time
                time.sleep(delay)

    @staticmethod
    def initialize():
        """Initialize database schema.
        
        Note: Schema is typically initialized via init.sql in docker-entrypoint-initdb.d
        This method can be used for ensuring schema exists.
        """
        # Schema is created via database/init.sql during PostgreSQL initialization
        # This is just a connectivity check
        conn = DatabaseService.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM responses")
        cursor.close()
        conn.close()
        logging.info("✅ Database schema verified")

    @staticmethod
    def get_all_responses(search: Optional[str] = None) -> List[Response]:
        """Get all responses, optionally filtered."""
        conn = DatabaseService.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if search:
            # PostgreSQL with ILIKE for case-insensitive search
            query = """
                SELECT * FROM responses
                WHERE title ILIKE %s OR content ILIKE %s OR tags::text ILIKE %s
                ORDER BY created_at DESC
            """
            search_term = f"%{search}%"
            cursor.execute(query, (search_term, search_term, search_term))
        else:
            cursor.execute("SELECT * FROM responses ORDER BY created_at DESC")

        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return [Response.from_db_row(row) for row in rows]

    @staticmethod
    def get_response_by_id(response_id: str) -> Optional[Response]:
        """Get a response by ID."""
        conn = DatabaseService.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cursor.execute("SELECT * FROM responses WHERE id = %s", (response_id,))
        row = cursor.fetchone()
        
        cursor.close()
        conn.close()

        if row is None:
            return None

        return Response.from_db_row(row)

    @staticmethod
    def create_response(title: str, content: str, tags: List[str]) -> Response:
        """Create a new response.
        
        Note: PostgreSQL auto-generates UUID, no need to pass response_id
        """
        conn = DatabaseService.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # PostgreSQL RETURNING clause gets the created record in one query
        query = """
            INSERT INTO responses (title, content, tags)
            VALUES (%s, %s, %s)
            RETURNING *
        """
        cursor.execute(query, (title, content, json.dumps(tags)))
        row = cursor.fetchone()
        
        cursor.close()
        conn.close()

        return Response.from_db_row(row)

    @staticmethod
    def update_response(
        response_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Optional[Response]:
        """Update an existing response."""
        conn = DatabaseService.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Check if exists
        cursor.execute("SELECT * FROM responses WHERE id = %s", (response_id,))
        row = cursor.fetchone()
        
        if row is None:
            cursor.close()
            conn.close()
            return None

        # Build update query
        updates = []
        params = []

        if title is not None:
            updates.append("title = %s")
            params.append(title)

        if content is not None:
            updates.append("content = %s")
            params.append(content)

        if tags is not None:
            updates.append("tags = %s")
            params.append(json.dumps(tags))

        if updates:
            # updated_at is automatically updated by trigger
            query = f'UPDATE responses SET {", ".join(updates)} WHERE id = %s RETURNING *'
            params.append(response_id)
            cursor.execute(query, params)
            row = cursor.fetchone()

        cursor.close()
        conn.close()

        return Response.from_db_row(row) if row else None

    @staticmethod
    def delete_response(response_id: str) -> bool:
        """Delete a response."""
        conn = DatabaseService.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM responses WHERE id = %s", (response_id,))
        row = cursor.fetchone()
        
        if row is None:
            cursor.close()
            conn.close()
            return False

        cursor.execute("DELETE FROM responses WHERE id = %s", (response_id,))
        cursor.close()
        conn.close()

        return True
