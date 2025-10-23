"""
Database service for managing responses
"""

import json
import uuid
from typing import List, Optional
from models import Response, User, Profile
import sqlite3

DATABASE = "responses.db"


class DatabaseService:
    """Service for database operations."""

    @staticmethod
    def get_connection():
        """Get database connection."""
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def initialize():
        """Initialize database schema."""
        conn = DatabaseService.get_connection()
        
        # Create responses table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS responses (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                tags TEXT,
                profile_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE SET NULL
            )
        ''')
        
        # Migration: Add profile_id column if it doesn't exist
        try:
            conn.execute('ALTER TABLE responses ADD COLUMN profile_id TEXT')
            print("✅ Added profile_id column to responses table")
        except Exception as e:
            if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                pass  # Column already exists, which is fine
            else:
                print(f"⚠️ Migration warning: {e}")
        
        # Create users table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                provider TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                avatar_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create profiles table
        conn.execute('''
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                profile_name TEXT NOT NULL,
                topic TEXT NOT NULL,
                is_active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        ''')
        
        # Create index for faster user lookups
        conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)
        ''')
        
        # Create index for faster profile lookups
        conn.execute('''
            CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id)
        ''')
        
        conn.commit()
        conn.close()

    @staticmethod
    def get_all_responses(search: Optional[str] = None, profile_id: Optional[str] = None) -> List[Response]:
        """Get all responses, optionally filtered by search and profile."""
        conn = DatabaseService.get_connection()
        
        if search and profile_id:
            query = '''
                SELECT * FROM responses 
                WHERE profile_id = ? AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)
                ORDER BY created_at DESC
            '''
            search_term = f'%{search}%'
            rows = conn.execute(query, (profile_id, search_term, search_term, search_term)).fetchall()
        elif search:
            query = '''
                SELECT * FROM responses 
                WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
                ORDER BY created_at DESC
            '''
            search_term = f'%{search}%'
            rows = conn.execute(query, (search_term, search_term, search_term)).fetchall()
        elif profile_id:
            rows = conn.execute('SELECT * FROM responses WHERE profile_id = ? ORDER BY created_at DESC', 
                               (profile_id,)).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM responses ORDER BY created_at DESC"
            ).fetchall()

        conn.close()
        return [Response.from_db_row(row) for row in rows]

    @staticmethod
    def get_response_by_id(response_id: str) -> Optional[Response]:
        """Get a response by ID."""
        conn = DatabaseService.get_connection()
        row = conn.execute(
            "SELECT * FROM responses WHERE id = ?", (response_id,)
        ).fetchone()
        conn.close()

        if row is None:
            return None

        return Response.from_db_row(row)

    @staticmethod
    def create_response(response_id: str, title: str, content: str, 
                       tags: List[str], profile_id: Optional[str] = None) -> Response:
        """Create a new response."""
        conn = DatabaseService.get_connection()
        tags_json = json.dumps(tags)

        conn.execute(
            'INSERT INTO responses (id, title, content, tags, profile_id) VALUES (?, ?, ?, ?, ?)',
            (response_id, title, content, tags_json, profile_id)
        )
        conn.commit()

        row = conn.execute(
            "SELECT * FROM responses WHERE id = ?", (response_id,)
        ).fetchone()
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

        # Check if exists
        row = conn.execute(
            "SELECT * FROM responses WHERE id = ?", (response_id,)
        ).fetchone()
        if row is None:
            conn.close()
            return None

        # Build update query
        updates = []
        params = []

        if title is not None:
            updates.append("title = ?")
            params.append(title)

        if content is not None:
            updates.append("content = ?")
            params.append(content)

        if tags is not None:
            updates.append("tags = ?")
            params.append(json.dumps(tags))

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            query = f'UPDATE responses SET {", ".join(updates)} WHERE id = ?'
            params.append(response_id)
            conn.execute(query, params)
            conn.commit()

        row = conn.execute(
            "SELECT * FROM responses WHERE id = ?", (response_id,)
        ).fetchone()
        conn.close()

        return Response.from_db_row(row)

    @staticmethod
    def delete_response(response_id: str) -> bool:
        """Delete a response."""
        conn = DatabaseService.get_connection()

        row = conn.execute(
            "SELECT * FROM responses WHERE id = ?", (response_id,)
        ).fetchone()
        if row is None:
            conn.close()
            return False

        conn.execute("DELETE FROM responses WHERE id = ?", (response_id,))
        conn.commit()
        conn.close()

        return True
    
    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[User]:
        """Get a user by their ID."""
        conn = DatabaseService.get_connection()
        row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        
        if row is None:
            return None
        
        return User.from_db_row(row)

    @staticmethod
    def get_user_by_email(email: str) -> Optional[User]:
        """Get a user by email."""
        conn = DatabaseService.get_connection()
        row = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
        conn.close()
        
        if row is None:
            return None
        
        return User.from_db_row(row)
    
    @staticmethod
    def get_user_by_provider_id(provider: str, provider_id: str) -> Optional[User]:
        """Get a user by provider and provider_id."""
        conn = DatabaseService.get_connection()
        row = conn.execute('SELECT * FROM users WHERE provider = ? AND provider_id = ?', 
                          (provider, provider_id)).fetchone()
        conn.close()
        
        if row is None:
            return None
        
        return User.from_db_row(row)
    
    @staticmethod
    def create_user(email: str, name: str, provider: str, 
                   provider_id: str, avatar_url: Optional[str] = None) -> User:
        """Create a new user."""
        conn = DatabaseService.get_connection()
        user_id = str(uuid.uuid4())
        
        conn.execute(
            'INSERT INTO users (id, email, name, provider, provider_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?)',
            (user_id, email, name, provider, provider_id, avatar_url)
        )
        conn.commit()
        
        row = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        
        return User.from_db_row(row)
    
    @staticmethod
    def get_profiles_by_user_id(user_id: str) -> List[Profile]:
        """Get all profiles for a user."""
        conn = DatabaseService.get_connection()
        rows = conn.execute('SELECT * FROM profiles WHERE user_id = ? ORDER BY created_at DESC', 
                           (user_id,)).fetchall()
        conn.close()
        
        return [Profile.from_db_row(row) for row in rows]
    
    @staticmethod
    def get_active_profile_by_user_id(user_id: str) -> Optional[Profile]:
        """Get the active profile for a user."""
        conn = DatabaseService.get_connection()
        row = conn.execute('SELECT * FROM profiles WHERE user_id = ? AND is_active = 1', 
                          (user_id,)).fetchone()
        conn.close()
        
        if row is None:
            return None
        
        return Profile.from_db_row(row)
    
    @staticmethod
    def create_profile(user_id: str, profile_name: str, topic: str, 
                      is_active: bool = False) -> Profile:
        """Create a new profile."""
        conn = DatabaseService.get_connection()
        profile_id = str(uuid.uuid4())
        
        # If this is the first profile for the user, make it active
        if is_active:
            # Deactivate any existing active profile
            conn.execute('UPDATE profiles SET is_active = 0 WHERE user_id = ?', (user_id,))
        
        conn.execute(
            'INSERT INTO profiles (id, user_id, profile_name, topic, is_active) VALUES (?, ?, ?, ?, ?)',
            (profile_id, user_id, profile_name, topic, is_active)
        )
        conn.commit()
        
        row = conn.execute('SELECT * FROM profiles WHERE id = ?', (profile_id,)).fetchone()
        conn.close()
        
        return Profile.from_db_row(row)
    
    @staticmethod
    def update_profile_active_status(profile_id: str, user_id: str, is_active: bool) -> Optional[Profile]:
        """Update the active status of a profile."""
        conn = DatabaseService.get_connection()
        
        # Deactivate any existing active profile
        if is_active:
            conn.execute('UPDATE profiles SET is_active = 0 WHERE user_id = ?', (user_id,))
        
        # Update the specified profile
        conn.execute('UPDATE profiles SET is_active = ? WHERE id = ?', (is_active, profile_id))
        conn.commit()
        
        row = conn.execute('SELECT * FROM profiles WHERE id = ?', (profile_id,)).fetchone()
        conn.close()
        
        if row is None:
            return None
        
        return Profile.from_db_row(row)
    
    @staticmethod
    def delete_profile(profile_id: str, user_id: str) -> bool:
        """Delete a profile."""
        conn = DatabaseService.get_connection()
        
        # Check if profile exists and belongs to user
        row = conn.execute('SELECT * FROM profiles WHERE id = ? AND user_id = ?', 
                          (profile_id, user_id)).fetchone()
        if row is None:
            conn.close()
            return False
        
        conn.execute('DELETE FROM profiles WHERE id = ?', (profile_id,))
        conn.commit()
        conn.close()
        
        return True
