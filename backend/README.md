# Canner Backend

Flask REST API for managing saved responses with OAuth authentication and user profiles.

## Features

- 🔐 OAuth authentication (Google & GitHub)
- 👤 User profiles with topic-based organization
- 📝 Response templates with tags and search
- 🗄️ PostgreSQL database support
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
DATABASE_URL=postgresql://developer:devpassword@localhost:5432/canner_dev
```

Response: 201 Created with the created response object (includes auto-generated UUID)

### Update Response

```http
PUT /api/responses/:id
Content-Type: application/json

{
  "title": "string (optional)",
  "content": "string (optional)",
  "tags": ["string"] (optional)
}
```

Response: 200 OK with updated response object

### Delete Response

```http
DELETE /api/responses/:id
```

Response: 204 No Content

### Health Check

```http
GET /api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T12:00:00",
  "database": "PostgreSQL",
  "database_connected": true
}
```

## 🛠️ Development

### Running with Docker

```bash
# Start backend with database
docker-compose up backend postgres

# View logs
docker-compose logs -f backend

# Rebuild after code changes
docker-compose up --build backend
```

### Database Management

```bash
# Access PostgreSQL CLI
docker-compose exec postgres psql -U developer -d canner_dev

# Run pgAdmin (optional)
docker-compose --profile admin up pgadmin
# Access at http://localhost:8080
# Email: admin@canner.dev
# Password: admin123
```

## 📦 Dependencies

- **Flask 3.0.0** - Web framework
- **flask-cors 4.0.0** - CORS support
- **psycopg2-binary 2.9.9** - PostgreSQL adapter
- **python-dotenv 1.0.0** - Environment variable management
- **flask-swagger-ui 4.11.1** - API documentation UI

## 🔍 Testing

```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Test create response
curl -X POST http://localhost:5000/api/responses \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "content": "Test content", "tags": ["test"]}'

# Test get all responses
curl http://localhost:5000/api/responses

# Test search
curl "http://localhost:5000/api/responses?search=test"
```

## 🚨 Troubleshooting

**Database connection errors:**
- Ensure PostgreSQL is running: `docker-compose ps postgres`
- Check DATABASE_URL is correct
- Verify PostgreSQL health: `docker-compose exec postgres pg_isready`

**Port already in use:**
```bash
# Change port in docker-compose.yml
ports:
  - "5001:5000"  # Use 5001 instead of 5000
```

## 📄 License

See LICENSE file in project root.