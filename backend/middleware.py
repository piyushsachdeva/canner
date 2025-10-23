"""
Middleware for route protection and authentication
"""
from functools import wraps
from flask import session, jsonify
from database import DatabaseService

def require_auth(f):
    """Decorator to require authentication for routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Verify user exists in database by internal user ID
        user = DatabaseService.get_user_by_id(session['user_id'])
        
        if not user:
            return jsonify({'error': 'User not found'}), 401
            
        return f(*args, **kwargs)
    
    return decorated_function

def get_current_user_id():
    """Get the current user ID from session."""
    return session.get('user_id')