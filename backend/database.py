"""
Database service for managing responses using PostgreSQL
"""

import json
import logging
import os
import uuid
from typing import List, Optional

import psycopg2
import psycopg2.extras

from models import Response, User


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
    def get_all_responses(search: Optional[str] = None, user_id: Optional[str] = None) -> List[Response]:
        """Get all responses, optionally filtered by search and user.
        
        Args:
            search: Optional search term to filter responses
            user_id: If provided, only returns responses belonging to this user
        """
        conn = DatabaseService.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        query = "SELECT * FROM responses"
        params = []
        conditions = []
        
        if search:
            conditions.append("(title ILIKE %s OR content ILIKE %s OR tags::text ILIKE %s)")
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term])
            
        if user_id is not None:
            conditions.append("user_id = %s")
            params.append(user_id)
            
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)

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
    def create_response(title: str, content: str, tags: List[str], user_id: Optional[str] = None) -> Response:
        """Create a new response.
        
        Args:
            title: Title of the response
            content: Content of the response
            tags: List of tags for the response
            user_id: Optional user ID to associate with the response
            
        Returns:
            The created Response object
            
        Note: PostgreSQL auto-generates UUID, no need to pass response_id
        """
        conn = DatabaseService.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # PostgreSQL RETURNING clause gets the created record in one query
        if user_id:
            query = """
                INSERT INTO responses (title, content, tags, user_id)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """
            cursor.execute(query, (title, content, json.dumps(tags), user_id))
        else:
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
    
    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[User]:
        """Get a user by their ID."""
        conn = DatabaseService.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row is None:
            return None
        
        return User.from_db_row(row)

    @staticmethod
    def get_user_by_email(email: str) -> Optional[User]:
        """Get a user by email."""
        conn = DatabaseService.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row is None:
            return None
        
        return User.from_db_row(row)
    
    @staticmethod
    def get_user_by_provider_id(provider: str, provider_id: str) -> Optional[User]:
        """Get a user by provider and provider_id."""
        conn = DatabaseService.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("SELECT * FROM users WHERE provider = %s AND provider_id = %s", 
                      (provider, provider_id))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if row is None:
            return None
        
        return User.from_db_row(row)
    
    @staticmethod
    def create_user(email: str, name: str, provider: str, 
                   provider_id: str, avatar_url: Optional[str] = None) -> User:
        """Create a new user."""
        conn = DatabaseService.get_connection()
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        user_id = str(uuid.uuid4())
        
        cursor.execute(
            "INSERT INTO users (id, email, name, provider, provider_id, avatar_url) VALUES (%s, %s, %s, %s, %s, %s) RETURNING *",
            (user_id, email, name, provider, provider_id, avatar_url)
        )
        row = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        return User.from_db_row(row)