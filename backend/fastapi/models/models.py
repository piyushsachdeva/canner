from pydantic import BaseModel, Field, validator, root_validator
from typing import List, Optional, Union
from datetime import datetime

# Database template -> expected data in this format
class ResponseBase(BaseModel):
    """Base response schema with common fields"""
    title: str = Field(..., min_length=1, max_length=255, description="Short title for the response template")
    content: str = Field(..., min_length=1, description="The full text content of the response")
    tags: List[str] = Field(default=[], description="Array of tags for categorizing the response")


# Schema for creating a new response
class ResponseCreate(BaseModel):
    """Schema for creating a new response"""
    title: str = Field(..., description="Title for the response template")
    content: str = Field(..., description="The full text content of the response")
    tags: List[str] = Field(default_factory=list, description="Tags as comma-separated string or array of strings")

    @validator('tags')
    def validate_and_convert_tags(cls, v):
        """Convert comma-separated string to list of strings, or validate list input"""
        if v is None:
            return []
        
        if isinstance(v, list):
            if not all(isinstance(tag, str) for tag in v):
                raise ValueError("All tags must be strings")
            seen = set()
            unique_tags = []
            for tag in v:
                tag = tag.strip()
                if tag and tag not in seen:
                    seen.add(tag)
                    unique_tags.append(tag)
            return unique_tags
        
        elif isinstance(v, str):
            if not v.strip():
                return []
            
            tag_list = [tag.strip() for tag in v.split(',') if tag.strip()]
            seen = set()
            unique_tags = []
            for tag in tag_list:
                if tag not in seen:
                    seen.add(tag)
                    unique_tags.append(tag)
            
            return unique_tags
        
        else:
            raise ValueError("Tags must be a list of strings or a comma-separated string")

# Schema for updating an existing response
class ResponseUpdate(BaseModel):
    """Schema for updating a response (all fields optional)"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    tags: Optional[Union[List[str], str]] = None

    @validator('tags')
    def validate_and_convert_tags(cls, v):
        """Convert comma-separated string to list of strings, or validate list input"""
        if v is None:
            return v
        
        if isinstance(v, list):
            if not all(isinstance(tag, str) for tag in v):
                raise ValueError("All tags must be strings")
            seen = set()
            unique_tags = []
            for tag in v:
                tag = tag.strip()
                if tag and tag not in seen:
                    seen.add(tag)
                    unique_tags.append(tag)
            return unique_tags
        
        elif isinstance(v, str):
            tag_list = [tag.strip() for tag in v.split(',') if tag.strip()]
            seen = set()
            unique_tags = []
            for tag in tag_list:
                if tag not in seen:
                    seen.add(tag)
                    unique_tags.append(tag)
            
            return unique_tags
        
        else:
            raise ValueError("Tags must be a list of strings or a comma-separated string")

# Schema for response output
class ResponseResponse(ResponseBase):
    """Schema for response output"""
    id: str = Field(..., description="Unique identifier for the response")
    created_at: datetime = Field(..., description="Timestamp when the response was created")
    updated_at: datetime = Field(..., description="Timestamp when the response was last updated")
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "title": "Connection Request - Developer",
                "content": "Hi! I'd like to connect with you. I'm a software developer with 5 years of experience.",
                "tags": ["connection", "developer", "networking"],
                "created_at": "2025-01-15T10:30:00Z",
                "updated_at": "2025-01-15T10:30:00Z"
            }
        }

# Schema for health response
class HealthResponse(BaseModel):
    """Health check response schema"""
    status: str
    timestamp: datetime
    database: str
    database_connected: bool
    error: Optional[str] = None

# Schema on how errors are returned
class ErrorResponse(BaseModel):
    """Error response schema"""
    error: str
    detail: Optional[str] = None