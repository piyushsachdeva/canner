from flask import Flask, request, jsonify, session, url_for
from flask_cors import CORS
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

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Environment variables loaded from .env file")
except ImportError:
    print("⚠️  python-dotenv not available, using system environment variables")

# Add the current directory to the path to import local modules
import sys
import os as os_path
sys.path.append(os_path.path.dirname(os_path.path.abspath(__file__)))

from auth import init_oauth, authenticate_user
# DatabaseService will be imported locally where needed to avoid circular imports

app = Flask(__name__)
secret_key = os.getenv('SECRET_KEY')
if not secret_key:
    raise RuntimeError("SECRET_KEY environment variable must be set for security reasons.")
app.secret_key = secret_key
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

# Configure CORS to allow credentials from known origins
allowed_origins = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
CORS(app, supports_credentials=True, origins=[o.strip() for o in allowed_origins])

# Initialize OAuth
print("Initializing OAuth...")
print(f"GOOGLE_CLIENT_ID from env: {os.getenv('GOOGLE_CLIENT_ID')}")
print(f"GOOGLE_CLIENT_SECRET from env: {os.getenv('GOOGLE_CLIENT_SECRET')}")
print(f"GITHUB_CLIENT_ID from env: {os.getenv('GITHUB_CLIENT_ID')}")
print(f"GITHUB_CLIENT_SECRET from env: {os.getenv('GITHUB_CLIENT_SECRET')}")

oauth = init_oauth(app)
print(f"OAuth initialized: {oauth is not None}")
if oauth:
    try:
        google_client = oauth.create_client('google')
        print(f"Google OAuth client available: {google_client is not None}")
    except Exception as e:
        print(f"Error creating Google OAuth client: {e}")
    
    try:
        github_client = oauth.create_client('github')
        print(f"GitHub OAuth client available: {github_client is not None}")
    except Exception as e:
        print(f"Error creating GitHub OAuth client: {e}")



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
    if conn is None:
        return None
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(query, params)
    # Handle both SELECT and RETURNING clauses
    if query.strip().upper().startswith("SELECT") or "RETURNING" in query.upper():
        result = cursor.fetchall()
        cursor.close()
        return result
    cursor.close()
    return None


def init_db(max_retries: int = 10):
    """Initialize the database with required tables.
    
    Note: Schema is typically created via init.sql, this verifies connectivity.

    Args:
        max_retries: Maximum number of initialization attempts
    """
    for attempt in range(max_retries + 1):
        try:
            # Use DatabaseService to initialize the database
            # Import locally to avoid circular imports
            import sys
            import os as os_path
            sys.path.append(os_path.path.dirname(os_path.path.abspath(__file__)))
            from database import DatabaseService
            DatabaseService.initialize()
            
            conn = get_db_connection()
            if conn is None:
                raise Exception("Failed to establish database connection")

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
        "user_id": row["user_id"] if "user_id" in row else None,
        "created_at": str(row["created_at"]) if row["created_at"] else None,
        "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
    }


@app.route("/api/responses", methods=["GET"])
def get_responses():
    """Get all responses, optionally filtered by search query and user authentication.
    
    Returns:
        - For authenticated users: Only their own responses
        - For unauthenticated users: Only public responses (where user_id is NULL)
    """
    search = request.args.get("search", "")
    user_id = session.get('user_id')

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Base query parts
        query_parts = ["SELECT * FROM responses"]
        params = []
        
        # Add user filter
        if user_id:
            query_parts.append("WHERE user_id = %s")
            params.append(user_id)
        else:
            query_parts.append("WHERE user_id IS NULL")
        
        # Add search filter if provided
        if search:
            search_condition = "(title ILIKE %s OR content ILIKE %s OR tags::text ILIKE %s)"
            search_term = f"%{search}%"
            
            if len(params) > 0:
                query_parts.append("AND")
            else:
                query_parts.append("WHERE")
                
            query_parts.append(search_condition)
            params.extend([search_term, search_term, search_term])
        
        # Add ordering
        query_parts.append("ORDER BY created_at DESC")
        
        # Execute the query
        query = " ".join(query_parts)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        responses = [dict_from_row(row) for row in rows]
        return jsonify(responses)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        
    finally:
        if 'cursor' in locals():
            cursor.close()
        conn.close()


@app.route("/api/responses/<response_id>", methods=["GET"])
def get_response(response_id: str):
    """Get a single response by ID."""
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

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
    
    if not data or 'title' not in data or 'content' not in data:
        return jsonify({'error': 'Title and content are required'}), 400
    
    title = data['title']
    content = data['content']
    tags = data.get('tags', [])
    
    # Get user_id for current user if authenticated
    user_id = session.get('user_id')
    
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        if user_id:
            # Create response with user_id for authenticated users
            query = """
                INSERT INTO responses (title, content, tags, user_id)
                VALUES (%s, %s, %s, %s)
                RETURNING *
            """
            cursor.execute(query, (title, content, json.dumps(tags), user_id))
        else:
            # Create response without user_id for unauthenticated users
            query = """
                INSERT INTO responses (title, content, tags)
                VALUES (%s, %s, %s)
                RETURNING *
            """
            cursor.execute(query, (title, content, json.dumps(tags)))
            
        row = cursor.fetchone()
        conn.commit()
        
        if row:
            response_data = dict_from_row(row)
            return jsonify(response_data), 201
        else:
            return jsonify({"error": "Failed to create response"}), 500
            
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
        
    finally:
        if 'cursor' in locals():
            cursor.close()
        conn.close()


@app.route("/api/responses/<response_id>", methods=["PATCH"])
def update_response(response_id: str):
    """Update an existing response (partial update)."""
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

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
        rows = execute_query(conn, query, tuple(params))
        response_data = dict_from_row(rows[0]) if rows else None
    else:
        response_data = dict_from_row(existing[0])

    conn.close()

    return jsonify(response_data)


@app.route("/api/responses/<response_id>", methods=["DELETE"])
def delete_response(response_id: str):
    """Delete a response."""
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500

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
        if conn is None:
            raise Exception("Failed to establish database connection")
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
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


@app.route('/api/auth/status')
def auth_status():
    """Check authentication status and return user info if authenticated."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"authenticated": False})
    
    conn = get_db_connection()
    if conn is None:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if user:
            return jsonify({
                "authenticated": True,
                "user": {
                    "id": user['id'],
                    "email": user['email'],
                    "name": user['name'],
                    "provider": user['provider'],
                    "avatar_url": user['avatar_url']
                }
            })
        else:
            # User not found in database, clear session
            session.clear()
            return jsonify({"authenticated": False})
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        
    finally:
        if 'cursor' in locals():
            cursor.close()
        conn.close()

@app.route('/api/auth/user')
def get_current_user():
    """Get the current authenticated user.
    
    This is kept for backward compatibility. New code should use /api/auth/status.
    """
    status = auth_status()
    if status.status_code != 200 or not status.json.get('authenticated'):
        return jsonify({'error': 'Not authenticated'}), 401
    return jsonify(status.json['user'])

    return jsonify(user.to_dict())

@app.route('/api/auth/login/<provider>')
def oauth_login(provider):
    """Initiate OAuth login flow."""
    # Debug print to check OAuth object
    global oauth  # Make sure we're using the global oauth object
    print(f"OAuth object in login route: {oauth}")
    print(f"OAuth type: {type(oauth)}")
    print(f"GOOGLE_CLIENT_ID from env: {os.getenv('GOOGLE_CLIENT_ID')}")
    print(f"GITHUB_CLIENT_ID from env: {os.getenv('GITHUB_CLIENT_ID')}")
    
    if oauth is None:
        print("OAuth is None, trying to reinitialize...")
        # Try to reinitialize OAuth
        from auth import init_oauth
        oauth = init_oauth(app)
        if oauth is None:
            print("OAuth reinitialization failed")
            return jsonify({'error': 'OAuth not configured'}), 500
        print("OAuth reinitialized successfully")
    
    if provider not in ['google', 'github']:
        return jsonify({'error': 'Unsupported provider'}), 400
    
    # Check if the OAuth client is available
    try:
        client = oauth.create_client(provider)
        if not client:
            print(f"Client for {provider} is None")
            return jsonify({'error': f'{provider} OAuth client not available'}), 500
        print(f"Client for {provider} created successfully")
    except Exception as e:
        print(f"Error creating OAuth client for {provider}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to create {provider} OAuth client'}), 500
    
    # Redirect to the OAuth provider
    try:
        redirect_uri = url_for('oauth_callback', provider=provider, _external=True)
        print(f"Redirect URI: {redirect_uri}")
        return client.authorize_redirect(redirect_uri)
    except Exception as e:
        print(f"Error during OAuth redirect: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to initiate OAuth flow'}), 500

@app.route('/api/auth/callback/<provider>')
def oauth_callback(provider):
    """Handle OAuth callback from the provider."""
    if provider not in ['google', 'github']:
        return jsonify({'error': 'Unsupported provider'}), 400
    
    # Check if OAuth is properly initialized
    if oauth is None:
        return jsonify({'error': 'OAuth not available'}), 500
    
    try:
        print(f"Processing OAuth callback for {provider}")
        token = oauth.create_client(provider).authorize_access_token()
        print(f"Received token: {token}")
        
        # Extract token value
        token_value = token.get('access_token') if isinstance(token, dict) else token
        print(f"Token value: {token_value}")
        
        if token_value is None:
            return jsonify({'error': 'Failed to get access token'}), 400
        
        user = authenticate_user(provider, token_value)
        print(f"Authenticated user: {user}")
        
        if not user:
            print("Authentication failed - no user returned")
            return jsonify({'error': 'Authentication failed'}), 401
        
        # Store user info in session
        session['user_id'] = user.id
        session['user_provider'] = user.provider
        session['user_email'] = user.email
        session['user_name'] = user.name
        session.permanent = True  # Make session permanent
        print(f"User session stored: {session}")
        
        # Redirect to frontend with success message
        return '''
        <html>
        <head>
            <title>Authentication Success</title>
        </head>
        <body>
            <script>
                // Send message to opener window
                if (window.opener) {
                    window.opener.postMessage({"type": "oauth-success"}, "*");
                }
                // Close this window
                window.close();
            </script>
            <div style="text-align: center; padding: 20px;">
                <h2>Authentication Successful!</h2>
                <p>You can close this window and return to the application.</p>
                <button onclick="window.close()">Close Window</button>
            </div>
        </body>
        </html>
        '''
        
    except Exception as e:
        print(f"OAuth callback error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Authentication failed'}), 500

@app.route('/api/auth/logout')
def logout():
    """Logout the current user."""
    session.clear()
    return jsonify({'message': 'Logged out successfully'})

if __name__ == '__main__':
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