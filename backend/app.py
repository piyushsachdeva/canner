import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Dict

import psycopg2
import psycopg2.extras
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)



def get_db_connection(max_retries: int = 5, base_delay: float = 1.0):
    """Create a PostgreSQL database connection with automatic retry logic.

    Args:
        max_retries: Maximum number of connection attempts
        base_delay: Base delay between retries (exponential backoff)
    """
    db_url = os.getenv("DATABASE_URL", "postgresql://developer:devpassword@postgres:5432/canner_dev")

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


def execute_query(conn, query: str, params: tuple = ()):
    """Execute a query with proper cursor handling for PostgreSQL."""
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(query, params)
    # Handle both SELECT and RETURNING clauses
    if query.strip().upper().startswith("SELECT") or "RETURNING" in query.upper():
        return cursor.fetchall()
    return None


def init_db(max_retries: int = 10):
    """Initialize the database with required tables.
    
    Note: Schema is typically created via init.sql, this verifies connectivity.

    Args:
        max_retries: Maximum number of initialization attempts
    """
    for attempt in range(max_retries + 1):
        try:
            conn = get_db_connection()

            # Verify the responses table exists (created via init.sql)
            query = "SELECT COUNT(*) FROM responses"
            cursor = conn.cursor()
            cursor.execute(query)
            cursor.close()
            conn.close()

            if attempt > 0:
                logging.info(
                    f"✅ Database initialized (PostgreSQL) after {attempt} retries"
                )
            else:
                logging.info("✅ Database initialized (PostgreSQL)")
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
    """Convert a PostgreSQL database row to a dictionary."""
    # PostgreSQL RealDictRow - tags is already JSONB (list/dict)
    tags = row["tags"] if row["tags"] is not None else []
    if isinstance(tags, str):
        tags = json.loads(tags)

    return {
        "id": str(row["id"]),  # UUID to string for JSON
        "title": row["title"],
        "content": row["content"],
        "tags": tags,
        "created_at": str(row["created_at"]) if row["created_at"] else None,
        "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
    }


@app.route("/api/responses", methods=["GET"])
def get_responses():
    """Get all responses, optionally filtered by search query."""
    search = request.args.get("search", "")

    conn = get_db_connection()

    if search:
        # PostgreSQL with ILIKE for case-insensitive search
        query = """
            SELECT * FROM responses
            WHERE title ILIKE %s OR content ILIKE %s OR tags::text ILIKE %s
            ORDER BY created_at DESC
        """
        search_term = f"%{search}%"
        rows = execute_query(conn, query, (search_term, search_term, search_term))
    else:
        rows = execute_query(conn, "SELECT * FROM responses ORDER BY created_at DESC")

    conn.close()

    responses = [dict_from_row(row) for row in rows] if rows else []
    return jsonify(responses)


@app.route("/api/responses/<response_id>", methods=["GET"])
def get_response(response_id: str):
    """Get a single response by ID."""
    conn = get_db_connection()

    # PostgreSQL uses UUID type
    query = "SELECT * FROM responses WHERE id = %s"
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

    # PostgreSQL with JSONB and auto-generated UUID via RETURNING
    query = """
        INSERT INTO responses (title, content, tags)
        VALUES (%s, %s, %s)
        RETURNING *
    """
    rows = execute_query(conn, query, (title, content, json.dumps(tags)))
    response_data = dict_from_row(rows[0]) if rows else None

    conn.close()

    if not response_data:
        return jsonify({"error": "Failed to create response"}), 500

    return jsonify(response_data), 201


@app.route("/api/responses/<response_id>", methods=["PATCH"])
def update_response(response_id: str):
    """Update an existing response (partial update)."""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db_connection()

    # Check if response exists
    check_query = "SELECT * FROM responses WHERE id = %s"
    existing = execute_query(conn, check_query, (response_id,))
    
    if not existing:
        conn.close()
        return jsonify({"error": "Response not found"}), 404

    # Build update query dynamically based on provided fields
    updates = []
    params = []

    if "title" in data:
        updates.append("title = %s")
        params.append(data["title"])

    if "content" in data:
        updates.append("content = %s")
        params.append(data["content"])

    if "tags" in data:
        updates.append("tags = %s::jsonb")
        params.append(json.dumps(data["tags"]))

    if updates:
        # PostgreSQL automatically updates updated_at via trigger
        query = (
            f'UPDATE responses SET {", ".join(updates)} WHERE id = %s RETURNING *'
        )
        params.append(response_id)
        rows = execute_query(conn, query, params)
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
    check_query = "SELECT * FROM responses WHERE id = %s"
    delete_query = "DELETE FROM responses WHERE id = %s"
    params = (response_id,)

    existing = execute_query(conn, check_query, params)
    if not existing:
        conn.close()
        return jsonify({"error": "Response not found"}), 404

    execute_query(conn, delete_query, params)
    conn.close()

    return "", 204


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint with database connectivity test."""
    try:
        # Test database connection
        conn = get_db_connection(max_retries=1)  # Quick test, don't wait long
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        conn.close()

        return jsonify(
            {
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "database": "PostgreSQL",
                "database_connected": True,
            }
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "status": "unhealthy",
                    "timestamp": datetime.now().isoformat(),
                    "database": "PostgreSQL",
                    "database_connected": False,
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
    db_url = os.getenv("DATABASE_URL", "postgresql://developer:devpassword@postgres:5432/canner_dev")
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
