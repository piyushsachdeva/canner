from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database.connection import get_database
from services.response_service import ResponseService

router = APIRouter()


def get_response_service(db: Session = Depends(get_database)) -> ResponseService:
    """Dependency to get response service"""
    return ResponseService(db)

# Get all unique tags
@router.get(
    "/tags",
    response_model=List[str],
    summary="Get all tags",
    description="Retrieve all unique tags used across responses"
)
async def get_tags(
    response_service: ResponseService = Depends(get_response_service)
):
    """Get all unique tags"""
    try:
        return response_service.get_all_tags()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve tags: {str(e)}")