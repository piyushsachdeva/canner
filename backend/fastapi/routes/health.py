from fastapi import APIRouter
from datetime import datetime
from models.models import HealthResponse
from database.connection import test_database_connection

router = APIRouter(
    prefix="/health",
    tags=["health"]
)


@router.get(
    "/",
    response_model=HealthResponse,
    summary="Health check",
    description="Check the health status of the API and database connection"
)
async def health_check():
    """Health check endpoint"""
    db_connected, db_error = test_database_connection()
    
    return HealthResponse(
        status="healthy" if db_connected else "unhealthy",
        timestamp=datetime.utcnow(),
        database="connected" if db_connected else "disconnected",
        database_connected=db_connected,
        error=db_error
    )