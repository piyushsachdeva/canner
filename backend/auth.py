"""
Authentication service for OAuth with Google and GitHub
"""
import os
import json
from flask import Flask, session, redirect, request, url_for
from typing import Optional, Dict, Any

# Conditional imports for OAuth
try:
    from authlib.integrations.flask_client import OAuth
    AUTHLIB_AVAILABLE = True
except ImportError:
    OAuth = None
    AUTHLIB_AVAILABLE = False

# Import database service
import sys
import os as os_path
sys.path.append(os_path.path.dirname(os_path.path.abspath(__file__)))
from database import DatabaseService
from models import User

# OAuth configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID')
GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET')

def init_oauth(app: Flask):
    """Initialize OAuth clients."""
    if not AUTHLIB_AVAILABLE:
        return None
    
    oauth = OAuth(app)
    
    # Google OAuth
    if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
        print("Registering Google OAuth client")
        oauth.register(
            name='google',
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
            server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
            client_kwargs={
                'scope': 'openid email profile'
            }
        )
    
    # GitHub OAuth
    if GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET:
        print("Registering GitHub OAuth client")
        oauth.register(
            name='github',
            client_id=GITHUB_CLIENT_ID,
            client_secret=GITHUB_CLIENT_SECRET,
            authorize_url='https://github.com/login/oauth/authorize',
            authorize_params=None,
            access_token_url='https://github.com/login/oauth/access_token',
            access_token_params=None,
            refresh_token_url=None,
            redirect_uri=None,
            client_kwargs={'scope': 'user:email'},
        )
    
    return oauth

def get_user_info(provider: str, token: str) -> Optional[Dict[str, Any]]:
    """Get user info from OAuth provider."""
    try:
        print(f"Getting user info for provider: {provider}")
        if provider == 'google':
            # For Google, we need to use the access token to get user info
            import requests
            # Use the access token to get user info from Google's userinfo endpoint
            user_info_url = 'https://www.googleapis.com/oauth2/v2/userinfo'
            headers = {'Authorization': f'Bearer {token}'}
            print(f"Making request to {user_info_url} with token: {token[:10]}...")
            response = requests.get(user_info_url, headers=headers)
            print(f"Google API response status: {response.status_code}")
            
            if response.status_code == 200:
                user_data = response.json()
                print(f"Google user data: {user_data}")
                return {
                    'id': user_data.get('id'),
                    'email': user_data.get('email'),
                    'name': user_data.get('name'),
                    'avatar_url': user_data.get('picture')
                }
            else:
                print(f"Google API error: {response.text}")
        elif provider == 'github':
            # For GitHub, we need to make API calls
            import requests
            # Get user info
            user_response = requests.get(
                'https://api.github.com/user',
                headers={'Authorization': f'token {token}'}
            )
            print(f"GitHub API response status: {user_response.status_code}")
            if user_response.status_code == 200:
                user_data = user_response.json()
                print(f"GitHub user data: {user_data}")
                # Get email (might be private)
                email = user_data.get('email')
                if not email:
                    # Get emails from GitHub API
                    emails_response = requests.get(
                        'https://api.github.com/user/emails',
                        headers={'Authorization': f'token {token}'}
                    )
                    if emails_response.status_code == 200:
                        emails = emails_response.json()
                        print(f"GitHub emails data: {emails}")
                        # Find primary email
                        for email_info in emails:
                            if email_info.get('primary'):
                                email = email_info.get('email')
                                break
                
                return {
                    'id': str(user_data.get('id')),
                    'email': email,
                    'name': user_data.get('name') or user_data.get('login'),
                    'avatar_url': user_data.get('avatar_url')
                }
            else:
                print(f"GitHub API error: {user_response.text}")
    except Exception as e:
        print(f"Error getting user info from {provider}: {e}")
        import traceback
        traceback.print_exc()
    
    return None

def authenticate_user(provider: str, token: str) -> Optional[User]:
    """Authenticate user and create account if needed."""
    print(f"Authenticating user with provider: {provider}")
    user_info = get_user_info(provider, token)
    print(f"User info received: {user_info}")
    if not user_info:
        print("No user info received, returning None")
        return None
    
    # Check if user exists
    user = DatabaseService.get_user_by_provider_id(provider, user_info['id'])
    if user:
        print(f"User found by provider ID: {user}")
        return user
    
    # Check if user exists with same email
    if user_info.get('email'):
        user = DatabaseService.get_user_by_email(user_info['email'])
        if user:
            print(f"User found by email: {user}")
            return user
    
    # Create new user
    try:
        print(f"Creating new user with info: {user_info}")
        user = DatabaseService.create_user(
            email=user_info['email'],
            name=user_info['name'],
            provider=provider,
            provider_id=user_info['id'],
            avatar_url=user_info.get('avatar_url')
        )
        print(f"Created user: {user}")
        
        # Create default profile for new user
        default_profile = DatabaseService.create_profile(
            user_id=user.id,
            profile_name="Default Profile",
            topic="General",
            is_active=True
        )
        print(f"Created default profile: {default_profile}")
        
        return user
    except Exception as e:
        print(f"Error creating user: {e}")
        import traceback
        traceback.print_exc()
        return None
