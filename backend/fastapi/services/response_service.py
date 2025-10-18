from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, String
from uuid import UUID
from database.models import Response
from models.models import ResponseCreate, ResponseUpdate
import uuid

class ResponseService:
    """Service layer for response operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_responses(self, search: Optional[str] = None, limit: int = 100) -> List[Response]:
        """Get all responses with optional search"""
        query = self.db.query(Response)
        
        if search:
            search_term = f"%{search}%"
            from database.connection import DATABASE_URL
            
            if DATABASE_URL and DATABASE_URL.startswith('postgresql'):
                query = query.filter(
                    (Response.title.ilike(search_term)) |
                    (Response.content.ilike(search_term)) |
                    (func.cast(Response.tags, String).ilike(search_term))
                )
            else:
                query = query.filter(
                    (Response.title.ilike(search_term)) |
                    (Response.content.ilike(search_term)) |
                    (Response.tags.ilike(search_term))
                )
        
        results = query.order_by(Response.updated_at.desc()).limit(limit).all()
        return results
    
    def get_response_by_id(self, response_id: UUID) -> Optional[Response]:
        """Get a single response by ID"""
        response = self.db.query(Response).filter(Response.id == response_id).first()
        return response
    
    def create_response(self, response_data: ResponseCreate) -> Response:
        """Create a new response"""
        
        db_response = Response(
            title=response_data.title,
            content=response_data.content,
            tags=response_data.tags
        )
        
        try:
            self.db.add(db_response)
            self.db.commit()
            self.db.refresh(db_response)
            return db_response
        except Exception as e:
            self.db.rollback()
            raise
    
    def update_response(self, response_id: UUID, response_data: ResponseUpdate) -> Optional[Response]:
        """Update an existing response"""
        
        db_response = self.get_response_by_id(response_id)
        if not db_response:
            return None
        
        updates = []
        
        if response_data.title is not None:
            db_response.title = response_data.title
            updates.append("title")
        
        if response_data.content is not None:
            db_response.content = response_data.content
            updates.append("content")
        
        if response_data.tags is not None:
            db_response.tags = response_data.tags
            updates.append("tags")
        
        try:
            self.db.commit()
            self.db.refresh(db_response)
            return db_response
        except Exception as e:
            self.db.rollback()
            raise
    
    def delete_response(self, response_id: UUID) -> bool:
        """Delete a response"""
        
        db_response = self.get_response_by_id(response_id)
        if not db_response:
            return False
        
        try:
            self.db.delete(db_response)
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise
    
    def get_all_tags(self) -> List[str]:
        """Get all unique tags"""
        responses = self.db.query(Response).all()
        all_tags = set()
        
        for response in responses:
            if response.tags:
                all_tags.update(response.tags)
        
        return sorted(list(all_tags))