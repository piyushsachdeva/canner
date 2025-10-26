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
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
from ai_service import AIResponseService, SuggestionContext
from analytics_service import AnalyticsService
from cache_service import cache, response_cache, rate_limiter, cached
from task_service import task_manager
from api_docs import api_docs_bp, swagger_ui_blueprint
import hashlib

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

# Register API documentation blueprints
app.register_blueprint(api_docs_bp, url_prefix='/api')
app.register_blueprint(swagger_ui_blueprint, url_prefix='/api/docs')

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


# Initialize services after function definitions
ai_service = AIResponseService()
analytics_service = AnalyticsService(get_db_connection)


@app.route("/")
def root():
    """Root endpoint - redirect to API documentation."""
    return jsonify({
        "message": "Welcome to Canner API",
        "version": "1.0.0",
        "documentation": "/api/docs",
        "health": "/api/health",
        "endpoints": {
            "responses": "/api/responses",
            "suggestions": "/api/suggestions",
            "analytics": "/api/analytics/usage",
            "health": "/api/health"
        }
    })


@app.route("/api/responses", methods=["GET"])
def get_responses():
    """Get all responses, optionally filtered by search query."""
    search = request.args.get("search", "")
    platform = request.args.get("platform", "")
    user_id = request.headers.get("X-User-ID", "default")
    
    # Check rate limiting
    client_ip = request.remote_addr
    if not rate_limiter.is_allowed(f"get_responses:{client_ip}", 100, 60):  # 100 requests per minute
        return jsonify({"error": "Rate limit exceeded"}), 429
    
    # Try cache first
    cached_responses = response_cache.get_responses(search, platform, user_id)
    if cached_responses is not None:
        return jsonify(cached_responses)

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
    
    # Cache the results
    response_cache.set_responses(responses, search, platform, user_id, ttl=300)  # 5 minutes
    
    return jsonify(responses)


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


@app.route("/api/suggestions", methods=["POST"])
def get_ai_suggestions():
    """Get AI-powered response suggestions based on context."""
    if not ai_service.is_available():
        return jsonify({"error": "AI service not available"}), 503
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    try:
        context = SuggestionContext(
            platform=data.get("platform", "linkedin"),
            conversation_text=data.get("conversation_text", ""),
            user_input=data.get("user_input", ""),
            tone=data.get("tone", "professional"),
            max_length=data.get("max_length", 280)
        )
        
        suggestions = ai_service.generate_suggestions(context)
        
        return jsonify({
            "suggestions": suggestions,
            "context": {
                "platform": context.platform,
                "tone": context.tone,
                "max_length": context.max_length
            }
        })
        
    except Exception as e:
        logging.error(f"Error generating suggestions: {e}")
        return jsonify({"error": "Failed to generate suggestions"}), 500


@app.route("/api/responses/smart-search", methods=["GET"])
def smart_search_responses():
    """Enhanced search with AI-powered relevance scoring."""
    query = request.args.get("q", "")
    platform = request.args.get("platform", "")
    tone = request.args.get("tone", "")
    
    if not query:
        return jsonify({"error": "Query parameter required"}), 400
    
    conn = get_db_connection()
    
    # Base search query
    if is_postgres():
        search_query = """
            SELECT *, 
                   ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', %s)) as relevance_score
            FROM responses
            WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', %s)
        """
        params = [query, query]
        
        # Add platform filter if specified
        if platform:
            search_query += " AND tags::text ILIKE %s"
            params.append(f"%{platform}%")
            
        # Add tone filter if specified  
        if tone:
            search_query += " AND tags::text ILIKE %s"
            params.append(f"%{tone}%")
            
        search_query += " ORDER BY relevance_score DESC, created_at DESC LIMIT 20"
        
    else:
        # SQLite fallback
        search_query = """
            SELECT * FROM responses
            WHERE title LIKE ? OR content LIKE ?
        """
        search_term = f"%{query}%"
        params = [search_term, search_term]
        
        if platform:
            search_query += " AND tags LIKE ?"
            params.append(f"%{platform}%")
            
        if tone:
            search_query += " AND tags LIKE ?"
            params.append(f"%{tone}%")
            
        search_query += " ORDER BY created_at DESC LIMIT 20"
    
    rows = execute_query(conn, search_query, params)
    conn.close()
    
    responses = [dict_from_row(row) for row in rows] if rows else []
    
    return jsonify({
        "responses": responses,
        "query": query,
        "filters": {"platform": platform, "tone": tone},
        "total": len(responses)
    })


@app.route("/api/analytics/usage", methods=["GET"])
def get_usage_analytics():
    """Get usage analytics for responses."""
    days = request.args.get("days", 30, type=int)
    
    conn = get_db_connection()
    
    try:
        if is_postgres():
            # Get response usage stats
            stats_query = """
                SELECT 
                    COUNT(*) as total_responses,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '%s days' THEN 1 END) as recent_responses,
                    AVG(LENGTH(content)) as avg_content_length,
                    COUNT(DISTINCT tags) as unique_tags
                FROM responses
            """
            stats = execute_query(conn, stats_query, (days,))
            
            # Get most popular tags
            tags_query = """
                SELECT tag, COUNT(*) as usage_count
                FROM (
                    SELECT jsonb_array_elements_text(tags) as tag
                    FROM responses
                    WHERE created_at >= NOW() - INTERVAL '%s days'
                ) tag_counts
                GROUP BY tag
                ORDER BY usage_count DESC
                LIMIT 10
            """
            popular_tags = execute_query(conn, tags_query, (days,))
            
        else:
            # SQLite fallback
            stats_query = """
                SELECT 
                    COUNT(*) as total_responses,
                    AVG(LENGTH(content)) as avg_content_length
                FROM responses
            """
            stats = execute_query(conn, stats_query)
            popular_tags = []
        
        conn.close()
        
        analytics = {
            "period_days": days,
            "stats": dict_from_row(stats[0]) if stats else {},
            "popular_tags": [dict_from_row(row) for row in popular_tags] if popular_tags else [],
            "generated_at": datetime.now().isoformat()
        }
        
        return jsonify(analytics)
        
    except Exception as e:
        conn.close()
        logging.error(f"Analytics error: {e}")
        return jsonify({"error": "Failed to generate analytics"}), 500


@app.route("/api/suggestions/async", methods=["POST"])
def get_ai_suggestions_async():
    """Get AI-powered response suggestions asynchronously."""
    if not ai_service.is_available():
        return jsonify({"error": "AI service not available"}), 503
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    user_id = request.headers.get("X-User-ID", "default")
    
    # Check if we have cached suggestions for this context
    context_str = json.dumps(data, sort_keys=True)
    context_hash = hashlib.md5(context_str.encode()).hexdigest()
    
    cached_suggestions = response_cache.get_ai_suggestion(context_hash)
    if cached_suggestions:
        return jsonify({
            "suggestions": cached_suggestions,
            "cached": True,
            "context_hash": context_hash
        })
    
    # Submit async task
    task_id = task_manager.generate_ai_suggestions_async(data, user_id)
    
    return jsonify({
        "task_id": task_id,
        "status": "submitted",
        "context_hash": context_hash,
        "check_url": f"/api/tasks/{task_id}"
    }), 202


@app.route("/api/analytics/async", methods=["GET"])
def get_analytics_async():
    """Generate analytics asynchronously."""
    days = request.args.get("days", 30, type=int)
    user_id = request.headers.get("X-User-ID", "default")
    
    # Submit async task
    task_id = task_manager.generate_analytics_async(days, user_id)
    
    return jsonify({
        "task_id": task_id,
        "status": "submitted",
        "check_url": f"/api/tasks/{task_id}"
    }), 202


@app.route("/api/export", methods=["POST"])
def export_data():
    """Export data in various formats."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    export_format = data.get("format", "json").lower()
    filters = data.get("filters", {})
    user_id = request.headers.get("X-User-ID", "default")
    
    if export_format not in ["json", "csv"]:
        return jsonify({"error": "Unsupported format. Use 'json' or 'csv'"}), 400
    
    # Submit async export task
    task_id = task_manager.export_data_async(export_format, filters, user_id)
    
    return jsonify({
        "task_id": task_id,
        "status": "submitted",
        "format": export_format,
        "check_url": f"/api/tasks/{task_id}"
    }), 202


@app.route("/api/tasks/<task_id>", methods=["GET"])
def get_task_status(task_id: str):
    """Get status of a background task."""
    result = task_manager.get_task_result(task_id)
    
    response_data = {
        "task_id": task_id,
        "status": result.status,
        "created_at": result.created_at.isoformat() if result.created_at else None,
        "completed_at": result.completed_at.isoformat() if result.completed_at else None
    }
    
    if result.result:
        response_data["result"] = result.result
    
    if result.error:
        response_data["error"] = result.error
    
    return jsonify(response_data)


@app.route("/api/tasks/<task_id>", methods=["DELETE"])
def cancel_task(task_id: str):
    """Cancel a background task."""
    success = task_manager.task_service.cancel_task(task_id)
    
    if success:
        return jsonify({"message": "Task cancelled successfully"})
    else:
        return jsonify({"error": "Failed to cancel task"}), 400


@app.route("/api/cache/stats", methods=["GET"])
def get_cache_stats():
    """Get cache performance statistics."""
    return jsonify(cache.get_stats())


@app.route("/api/cache/clear", methods=["POST"])
def clear_cache():
    """Clear all cache entries."""
    success = cache.clear()
    
    if success:
        return jsonify({"message": "Cache cleared successfully"})
    else:
        return jsonify({"error": "Failed to clear cache"}), 500


@app.route("/api/responses/<response_id>/track", methods=["POST"])
def track_response_usage(response_id: str):
    """Track response usage for analytics."""
    data = request.get_json() or {}
    action = data.get("action", "used")
    platform = data.get("platform")
    user_agent = request.headers.get("User-Agent")
    
    try:
        analytics_service.track_response_usage(response_id, action, platform, user_agent)
        
        # Invalidate related caches
        user_id = request.headers.get("X-User-ID", "default")
        response_cache.invalidate_user_responses(user_id)
        
        return jsonify({"message": "Usage tracked successfully"})
    except Exception as e:
        logging.error(f"Failed to track usage: {e}")
        return jsonify({"error": "Failed to track usage"}), 500


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
                "ai_service_available": ai_service.is_available(),
                "features": {
                    "ai_suggestions": ai_service.is_available(),
                    "smart_search": True,
                    "analytics": True
                }
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
                    "ai_service_available": False,
                    "error": str(e),
                }
            ),
            503,
        )


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

        logging.info("🚀 Starting Flask server on http://0.0.0.0:5000")
        app.run(debug=True, host="0.0.0.0", port=5000)

    except Exception as e:
        logging.error(f"❌ Failed to start application: {e}")
        exit(1)
