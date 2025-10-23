# Canner Backend

Flask REST API for managing saved responses with OAuth authentication and user profiles.

## Features

- 🔐 OAuth authentication (Google & GitHub)
- 👤 User profiles with topic-based organization
- 📝 Response templates with tags and search
- 🗄️ SQLite/PostgreSQL database support
- 🌐 CORS support for browser extensions
- 📚 Interactive API documentation with Swagger

## Setup

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your OAuth credentials and settings
```

3. **Run the server:**
```bash
python app.py
```

The server will start on `http://localhost:5000` with Swagger docs at `http://localhost:5000/docs/`

## API Documentation

### Authentication Endpoints

```
GET  /api/auth/login/google     # Initiate Google OAuth
GET  /api/auth/login/github     # Initiate GitHub OAuth
GET  /api/auth/callback/:provider # OAuth callback handler
GET  /api/auth/user             # Get current user info
GET  /api/auth/logout           # Logout current user
```

### Profile Management

```
GET  /api/profiles              # Get all user profiles
GET  /api/profiles/active       # Get active profile
POST /api/profiles              # Create new profile
POST /api/profiles/:id/activate # Activate profile
DELETE /api/profiles/:id        # Delete profile
```

### Response Management

```
GET    /api/responses           # Get all responses (filtered by active profile)
GET    /api/responses/:id       # Get single response
POST   /api/responses           # Create response
PUT    /api/responses/:id       # Update response
DELETE /api/responses/:id       # Delete response
```

**Query Parameters for GET /api/responses:**
- `search`: Optional search term (searches title, content, tags)

**Request Body for POST /api/responses:**
```json
{
  "title": "string",
  "content": "string", 
  "tags": ["string"]
}
```

### System Endpoints

```
GET /api/health                 # Health check with database status
GET /docs/                      # Interactive Swagger documentation
```

## Database Schema

### users table
- `id` (TEXT, PRIMARY KEY) - Internal user UUID
- `email` (TEXT, UNIQUE, NOT NULL)
- `name` (TEXT, NOT NULL)
- `provider` (TEXT, NOT NULL) - 'google' or 'github'
- `provider_id` (TEXT, NOT NULL) - OAuth provider user ID
- `avatar_url` (TEXT)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### profiles table
- `id` (TEXT, PRIMARY KEY)
- `user_id` (TEXT, NOT NULL) - Foreign key to users.id
- `profile_name` (TEXT, NOT NULL)
- `topic` (TEXT, NOT NULL)
- `is_active` (BOOLEAN, DEFAULT FALSE)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### responses table
- `id` (TEXT, PRIMARY KEY)
- `title` (TEXT, NOT NULL)
- `content` (TEXT, NOT NULL)
- `tags` (TEXT, JSON array)
- `profile_id` (TEXT) - Foreign key to profiles.id
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Flask Configuration
SECRET_KEY=your_secret_key_here
FRONTEND_URL=http://localhost:3000

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,chrome-extension://your_extension_id

# Database Configuration (optional)
DATABASE_URL=sqlite:///responses.db
```

## OAuth Setup

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:5000/api/auth/callback/google`

### GitHub OAuth
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL: `http://localhost:5000/api/auth/callback/github`

## Development

- Database is created automatically on first run
- Supports both SQLite (default) and PostgreSQL
- Hot reload enabled in debug mode
- CORS configured for browser extension support

## Requirements

- Python 3.8+
- Flask 3.0.0
- SQLite3 or PostgreSQL (optional)
- OAuth provider credentials
