from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import responses, health, tags
from database.connection import create_tables, DATABASE_URL
import logging
import uvicorn
import os
from database.connection import test_database_connection

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Canner API",
    description="A FastAPI-based backend for managing canned responses for LinkedIn and Twitter",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(responses.router)
app.include_router(tags.router)

@app.on_event("startup")
async def startup_event():
    """Create database tables on startup"""
    logger.info("started canner")
    
    # Test database connection
    connected, error = test_database_connection()
    
    if connected:
        logger.info("database connected with postgres")
        create_tables()

        try:
            from database.connection import SessionLocal
            from services.response_service import ResponseService
            db = SessionLocal()
            service = ResponseService(db)
            db.close()
        except Exception as e:
            pass
            
    else:
        raise Exception(f"Cannot start application - database connection failed: {error}")
    
    logger.info("🚀 Canner API set up")
    logger.info("📑 Documentation : doc at /doc")
    logger.info("📑 Documentation : redoc at /redoc")

@app.get("/", tags=["root"])
async def root():
    """Root endpoint"""
    return {
        "message": "Canner API - by FastAPI",
        "version": "2.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
