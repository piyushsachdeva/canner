"""
Database service for managing responses
"""
import sqlite3
import json
from typing import List, Optional
from models import Response
from datetime import datetime
DATABASE = 'responses.db'


class DatabaseService:
    """Service for database operations."""
    
    @staticmethod
    def get_connection():
        """Get database connection with connection logging."""
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row

        # ✅ Tiny functional improvement: log database connection creation
        print(f"[{datetime.now().isoformat()}] ✅ Database connection opened: {DATABASE}")

        return conn
    
    @staticmethod
    def initialize():
        """Initialize database schema."""
        conn = DatabaseService.get_connection()
        conn.execute('''
            CREATE TABLE IF NOT EXISTS responses (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                tags TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        conn.close()
    
    @staticmethod
    def get_all_responses(search: Optional[str] = None) -> List[Response]:
        """Get all responses, optionally filtered."""
        conn = DatabaseService.get_connection()
        
        if search:
            query = '''
                SELECT * FROM responses 
                WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
                ORDER BY created_at DESC
            '''
            search_term = f'%{search}%'
            rows = conn.execute(query, (search_term, search_term, search_term)).fetchall()
        else:
            rows = conn.execute('SELECT * FROM responses ORDER BY created_at DESC').fetchall()
        
        conn.close()
        return [Response.from_db_row(row) for row in rows]
    
    @staticmethod
    def get_response_by_id(response_id: str) -> Optional[Response]:
        """Get a response by ID."""
        conn = DatabaseService.get_connection()
        row = conn.execute('SELECT * FROM responses WHERE id = ?', (response_id,)).fetchone()
        conn.close()
        
        if row is None:
            return None
        
        return Response.from_db_row(row)
    
    @staticmethod
    def create_response(response_id: str, title: str, content: str, 
                       tags: List[str]) -> Response:
        """Create a new response."""
        conn = DatabaseService.get_connection()
        tags_json = json.dumps(tags)
        
        conn.execute(
            'INSERT INTO responses (id, title, content, tags) VALUES (?, ?, ?, ?)',
            (response_id, title, content, tags_json)
        )
        conn.commit()
        
        row = conn.execute('SELECT * FROM responses WHERE id = ?', (response_id,)).fetchone()
        conn.close()
        
        return Response.from_db_row(row)
    
    @staticmethod
    def update_response(response_id: str, title: Optional[str] = None,
                       content: Optional[str] = None, 
                       tags: Optional[List[str]] = None) -> Optional[Response]:
        """Update an existing response."""
        conn = DatabaseService.get_connection()
        
        # Check if exists
        row = conn.execute('SELECT * FROM responses WHERE id = ?', (response_id,)).fetchone()
        if row is None:
            conn.close()
            return None
        
        # Build update query
        updates = []
        params = []
        
        if title is not None:
            updates.append('title = ?')
            params.append(title)
        
        if content is not None:
            updates.append('content = ?')
            params.append(content)
        
        if tags is not None:
            updates.append('tags = ?')
            params.append(json.dumps(tags))
        
        if updates:
            updates.append('updated_at = CURRENT_TIMESTAMP')
            query = f'UPDATE responses SET {", ".join(updates)} WHERE id = ?'
            params.append(response_id)
            conn.execute(query, params)
            conn.commit()
        
        row = conn.execute('SELECT * FROM responses WHERE id = ?', (response_id,)).fetchone()
        conn.close()
        
        return Response.from_db_row(row)
    
    @staticmethod
    def delete_response(response_id: str) -> bool:
        """Delete a response."""
        conn = DatabaseService.get_connection()
        
        row = conn.execute('SELECT * FROM responses WHERE id = ?', (response_id,)).fetchone()
        if row is None:
            conn.close()
            return False
        
        conn.execute('DELETE FROM responses WHERE id = ?', (response_id,))
        conn.commit()
        conn.close()
        
        return True
