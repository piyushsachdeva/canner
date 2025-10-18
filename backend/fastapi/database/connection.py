from http.client import HTTPException
import os
import logging
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
import time
import psycopg2

logger = logging.getLogger(__name__)

"""Database configuration"""

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./responses.db"

db_type = "PostgreSQL" if DATABASE_URL.startswith('postgresql') else "SQLite"

try:
    if DATABASE_URL.startswith('postgresql'):
        engine = create_engine(DATABASE_URL)
    else:
        DATABASE_URL = "sqlite:///./responses.db"
        engine = create_engine(
            DATABASE_URL, 
            connect_args={"check_same_thread": False}
        )
        
except Exception as e:
    DATABASE_URL = "sqlite:///./responses.db"
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_database():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create tables: {e}")

def test_database_connection():
    max_retries = 5
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()
            return True, None
        except OperationalError as e:
            logger.warning(f"⚠️  Database connection attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                logger.info(f"⏳ Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                return False, str(e)
            
    return False, "Maximum retries exceeded"