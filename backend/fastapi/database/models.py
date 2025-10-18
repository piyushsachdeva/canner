from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
from database.connection import Base, DATABASE_URL
import json

class Response(Base):
    """SQLAlchemy model for responses - matches PostgreSQL init.sql schema"""
    __tablename__ = "responses"
    
    if DATABASE_URL and DATABASE_URL.startswith('postgresql'):
        id = Column(UUID(as_uuid=False), primary_key=True, server_default=func.gen_random_uuid())
        tags = Column(JSONB, server_default="'[]'::jsonb")
    else:
        id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
        tags = Column(Text, default="[]")
    
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        """Convert model to dictionary"""
        
        if isinstance(self.tags, str):
            try:
                tags = json.loads(self.tags)
            except:
                tags = []
        else:
            tags = self.tags or []
            
        return {
            'id': str(self.id),
            'title': self.title,
            'content': self.content,
            'tags': tags,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }
        