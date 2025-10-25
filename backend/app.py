
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import sqlite3
import json
import logging
import os
import sqlite3
import time
import uuid
from datetime import datetime
from typing import Any, Dict, Union

from flask import Flask, jsonify, request
from flask_cors import CORS

# Try to import PostgreSQL driver
try:
    import psycopg2
    import psycopg2.extras

    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False
    print("⚠️  psycopg2 not available. PostgreSQL support disabled.")

app = Flask(__name__)
CORS(app)

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["1000 per day", "200 per hour"],  # Global default limits
    storage_uri="memory://",  # In-memory storage (change to redis://localhost:6379 for production)
    strategy="fixed-window",  # Can be changed to "moving-window" for more accuracy
)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///responses.db")
DATABASE = "responses.db"  # Fallback for SQLite


def get_db_connection(max_retries: int = 5, base_delay: float = 1.0):
    """Create a database connection with automatic retry logic.

    Args:
        max_retries: Maximum number of connection attempts
        base_delay: Base delay between retries (exponential backoff)
    """
    db_url = os.getenv("DATABASE_URL", "sqlite:///responses.db")

    if db_url.startswith("postgresql://") or db_url.startswith("postgres://"):
        if not POSTGRES_AVAILABLE:
            raise ImportError("PostgreSQL URL provided but psycopg2 not installed")

        # PostgreSQL connection with retry logic
        for attempt in range(max_retries + 1):
            try:
                conn = psycopg2.connect(db_url)
                conn.autocommit = True

                # Test the connection
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.close()

                if attempt > 0:
                    logging.info(
                        f"✅ PostgreSQL connection established after {attempt} retries"
                    )
                return conn

            except (psycopg2.OperationalError, psycopg2.DatabaseError) as e:
                if attempt == max_retries:
                    logging.error(
                        f"❌ Failed to connect to PostgreSQL after {max_retries} attempts: {e}"
                    )
                    raise

                delay = base_delay * (2**attempt)  # Exponential backoff
                logging.warning(
                    f"⚠️  PostgreSQL connection attempt {attempt + 1} failed, retrying in {delay}s: {e}"
                )
                time.sleep(delay)
    else:
        # SQLite connection (default) - no retry needed for local files
        # Extract path from URL if it's a sqlite:// URL, otherwise use as-is
        if db_url.startswith("sqlite:///"):
            db_path = db_url[10:]  # Remove 'sqlite:///' prefix
        elif db_url.startswith("sqlite://"):
            db_path = db_url[9:]  # Remove 'sqlite://' prefix
        else:
            db_path = db_url

        # Ensure directory exists for SQLite
        os.makedirs(
            os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True
        )

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn


def is_postgres():
    """Check if we're using PostgreSQL."""
    db_url = os.getenv("DATABASE_URL", "sqlite:///responses.db")
    return db_url.startswith("postgresql://") or db_url.startswith("postgres://")


def execute_query(conn, query: str, params: tuple = ()) -> Union[list, None]:
    """Execute a query with proper cursor handling for both SQLite and PostgreSQL."""
    if is_postgres():
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(query, params)
        # Handle both SELECT and RETURNING clauses
        if query.strip().upper().startswith("SELECT") or "RETURNING" in query.upper():
            return cursor.fetchall()
        return None
    else:
        cursor = conn.execute(query, params)
        if query.strip().upper().startswith("SELECT"):
            return cursor.fetchall()
        conn.commit()
        return None


def init_db(max_retries: int = 10):
    """Initialize the database with required tables.

    Args:
        max_retries: Maximum number of initialization attempts
    """
    for attempt in range(max_retries + 1):
        try:
            conn = get_db_connection()

            if is_postgres():
                # PostgreSQL schema
                query = """
                    CREATE TABLE IF NOT EXISTS responses (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        title VARCHAR(255) NOT NULL,
                        content TEXT NOT NULL,
                        tags JSONB DEFAULT '[]'::jsonb,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                """
            else:
                # SQLite schema
                query = """
                    CREATE TABLE IF NOT EXISTS responses (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        content TEXT NOT NULL,
                        tags TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """

            execute_query(conn, query)
            conn.close()

            db_type = "PostgreSQL" if is_postgres() else "SQLite"
            if attempt > 0:
                logging.info(
                    f"✅ Database initialized ({db_type}) after {attempt} retries"
                )
            else:
                logging.info(f"✅ Database initialized ({db_type})")
            return

        except Exception as e:
            if attempt == max_retries:
                logging.error(
                    f"❌ Failed to initialize database after {max_retries} attempts: {e}"
                )
                raise

            delay = 2**attempt  # Exponential backoff
            logging.warning(
                f"⚠️  Database initialization attempt {attempt + 1} failed, retrying in {delay}s: {e}"
            )
            time.sleep(delay)


def dict_from_row(row) -> Dict[str, Any]:
    """Convert a database row to a dictionary."""
    if is_postgres():
        # PostgreSQL RealDictRow - tags is already JSONB (list/dict)
        tags = row["tags"] if row["tags"] is not None else []
        if isinstance(tags, str):
            tags = json.loads(tags)
    else:
        # SQLite Row - tags is JSON string
        tags = json.loads(row["tags"]) if row["tags"] else []

    return {
        "id": str(row["id"]),  # Ensure ID is always string for consistency
        "title": row["title"],
        "content": row["content"],
        "tags": tags,
        "created_at": str(row["created_at"]) if row["created_at"] else None,
        "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
    }



@app.route('/api/responses', methods=['GET'])
@limiter.limit("200 per hour")  # Read operations - moderate limit to prevent scraping
@app.route("/api/responses", methods=["GET"])
def get_responses():
    """Get all responses, optionally filtered by search query."""
    search = request.args.get("search", "")

    conn = get_db_connection()

    if search:
        if is_postgres():
            # PostgreSQL with ILIKE for case-insensitive search and JSONB contains
            query = """
                SELECT * FROM responses
                WHERE title ILIKE %s OR content ILIKE %s OR tags::text ILIKE %s
                ORDER BY created_at DESC
            """
            search_term = f"%{search}%"
            rows = execute_query(conn, query, (search_term, search_term, search_term))
        else:
            # SQLite with LIKE
            query = """
                SELECT * FROM responses
                WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?
                ORDER BY created_at DESC
            """
            search_term = f"%{search}%"
            rows = execute_query(conn, query, (search_term, search_term, search_term))
    else:
        rows = execute_query(conn, "SELECT * FROM responses ORDER BY created_at DESC")

    conn.close()

    responses = [dict_from_row(row) for row in rows] if rows else []
    return jsonify(responses)



@app.route('/api/responses/<response_id>', methods=['GET'])
@limiter.limit("50 per hour")  # Single read - higher limit, less expensive
@app.route("/api/responses/<response_id>", methods=["GET"])
def get_response(response_id: str):
    """Get a single response by ID."""
    conn = get_db_connection()

    if is_postgres():
        # PostgreSQL uses UUID type
        query = "SELECT * FROM responses WHERE id = %s"
        rows = execute_query(conn, query, (response_id,))
    else:
        # SQLite uses TEXT
        query = "SELECT * FROM responses WHERE id = ?"
        rows = execute_query(conn, query, (response_id,))

    conn.close()

    if not rows:
        return jsonify({"error": "Response not found"}), 404

    return jsonify(dict_from_row(rows[0]))



@app.route('/api/responses', methods=['POST'])
@limiter.limit("50 per hour")  # Write operations - strict limit as specified
@app.route("/api/responses", methods=["POST"])
def create_response():
    """Create a new response."""
    data = request.get_json()

    if not data or "title" not in data or "content" not in data:
        return jsonify({"error": "Title and content are required"}), 400

    title = data["title"]
    content = data["content"]
    tags = data.get("tags", [])

    conn = get_db_connection()

    if is_postgres():
        # PostgreSQL with JSONB and auto-generated UUID
        query = """
            INSERT INTO responses (title, content, tags)
            VALUES (%s, %s, %s)
            RETURNING *
        """
        rows = execute_query(conn, query, (title, content, json.dumps(tags)))
        response_data = dict_from_row(rows[0]) if rows else None
    else:
        # SQLite with manual UUID
        response_id = str(uuid.uuid4())
        query = "INSERT INTO responses (id, title, content, tags) VALUES (?, ?, ?, ?)"
        execute_query(conn, query, (response_id, title, content, json.dumps(tags)))

        # Fetch the created record
        rows = execute_query(
            conn, "SELECT * FROM responses WHERE id = ?", (response_id,)
        )
        response_data = dict_from_row(rows[0]) if rows else None

    conn.close()

    if not response_data:
        return jsonify({"error": "Failed to create response"}), 500

    return jsonify(response_data), 201



@app.route('/api/responses/<response_id>', methods=['PUT'])
@limiter.limit("50 per hour")  # Update operations - moderate limit
@app.route("/api/responses/<response_id>", methods=["PUT"])
def update_response(response_id: str):
    """Update an existing response."""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db_connection()

    # Check if response exists
    if is_postgres():
        check_query = "SELECT * FROM responses WHERE id = %s"
        check_params = (response_id,)
    else:
        check_query = "SELECT * FROM responses WHERE id = ?"
        check_params = (response_id,)

    existing = execute_query(conn, check_query, check_params)
    if not existing:
        conn.close()
        return jsonify({"error": "Response not found"}), 404

    # Build update query dynamically based on provided fields
    updates = []
    params = []

    if "title" in data:
        updates.append("title = %s" if is_postgres() else "title = ?")
        params.append(data["title"])

    if "content" in data:
        updates.append("content = %s" if is_postgres() else "content = ?")
        params.append(data["content"])

    if "tags" in data:
        if is_postgres():
            updates.append("tags = %s::jsonb")
            params.append(json.dumps(data["tags"]))
        else:
            updates.append("tags = ?")
            params.append(json.dumps(data["tags"]))

    if updates:
        if is_postgres():
            updates.append("updated_at = CURRENT_TIMESTAMP")
            query = (
                f'UPDATE responses SET {", ".join(updates)} WHERE id = %s RETURNING *'
            )
            params.append(response_id)
            rows = execute_query(conn, query, params)
            response_data = dict_from_row(rows[0]) if rows else None
        else:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            query = f'UPDATE responses SET {", ".join(updates)} WHERE id = ?'
            params.append(response_id)
            execute_query(conn, query, params)

            # Fetch updated record
            rows = execute_query(
                conn, "SELECT * FROM responses WHERE id = ?", (response_id,)
            )
            response_data = dict_from_row(rows[0]) if rows else None
    else:
        response_data = dict_from_row(existing[0])

    conn.close()

    return jsonify(response_data)



@app.route('/api/responses/<response_id>', methods=['DELETE'])
@limiter.limit("30 per hour")  # Delete operations - strict limit, destructive action
@app.route("/api/responses/<response_id>", methods=["DELETE"])
def delete_response(response_id: str):
    """Delete a response."""
    conn = get_db_connection()

    # Check if response exists
    if is_postgres():
        check_query = "SELECT * FROM responses WHERE id = %s"
        delete_query = "DELETE FROM responses WHERE id = %s"
        params = (response_id,)
    else:
        check_query = "SELECT * FROM responses WHERE id = ?"
        delete_query = "DELETE FROM responses WHERE id = ?"
        params = (response_id,)

    existing = execute_query(conn, check_query, params)
    if not existing:
        conn.close()
        return jsonify({"error": "Response not found"}), 404

    execute_query(conn, delete_query, params)
    conn.close()

    return "", 204


@app.route('/api/health', methods=['GET'])
@limiter.exempt  # Health checks should not be rate limited
@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint with database connectivity test."""
    try:
        # Test database connection
        conn = get_db_connection(max_retries=1)  # Quick test, don't wait long
        cursor = conn.cursor() if is_postgres() else conn

        if is_postgres():
            cursor.execute("SELECT 1")
        else:
            cursor.execute("SELECT 1")

        conn.close()

        return jsonify(
            {
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "database": "PostgreSQL" if is_postgres() else "SQLite",
                "database_connected": True,
            }
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "status": "unhealthy",
                    "timestamp": datetime.now().isoformat(),
                    "database": "PostgreSQL" if is_postgres() else "SQLite",
                    "database_connected": False,
                    "error": str(e),
                }
            ),
            503,
        )



# Custom error handler for rate limit exceeded
@app.errorhandler(429)
def ratelimit_handler(e):
    """Custom handler for rate limit errors."""
    return jsonify({
        'error': 'Rate limit exceeded',
        'message': 'Too many requests. Please try again later.',
        'retry_after': e.description
    }), 429


if __name__ == '__main__':

if __name__ == "__main__":

    # Configure logging
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
    )

    # Show which database we're using
    db_url = os.getenv("DATABASE_URL", "sqlite:///responses.db")
    logging.info(f"🔧 Using DATABASE_URL: {db_url}")

    try:
        # Initialize database with retry logic
        logging.info("🔄 Initializing database...")
        init_db()

        
        logging.info('🚀 Starting Flask server on http://0.0.0.0:5000')
        logging.info('🛡️  Rate limiting enabled:')
        logging.info('   • POST /api/responses: 50 per hour')
        logging.info('   • PUT /api/responses/<id>: 50 per hour')
        logging.info('   • DELETE /api/responses/<id>: 30 per hour')
        logging.info('   • GET /api/responses: 200 per hour')
        logging.info('   • GET /api/responses/<id>: 50 per hour')
        
        app.run(debug=True, host='0.0.0.0', port=5000)
        
    except Exception as e:
        logging.error(f'❌ Failed to start application: {e}')
        exit(1)


        logging.info("🚀 Starting Flask server on http://0.0.0.0:5000")
        app.run(debug=True, host="0.0.0.0", port=5000)

    except Exception as e:
        logging.error(f"❌ Failed to start application: {e}")
        exit(1)

