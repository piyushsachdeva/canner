# Canner Backend

Flask REST API for managing saved responses with PostgreSQL database.

## 🚀 Quick Start

### Using Docker Compose (Recommended)

```bash
# From the project root directory
docker-compose up backend postgres

# The backend will be available at http://localhost:5000
```

### Manual Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variable
export DATABASE_URL="postgresql://developer:devpassword@localhost:5432/canner_dev"

# Run the application
python app.py
```

## 📋 Prerequisites

- Python 3.8+
- PostgreSQL 12+
- Docker & Docker Compose (for containerized setup)

## ⚙️ Environment Variables

```bash
DATABASE_URL=postgresql://user:password@host:port/database_name
```

Default: `postgresql://developer:devpassword@postgres:5432/canner_dev`

## 🗄️ Database

This backend uses **PostgreSQL** exclusively with the following features:

- **JSONB** for storing tags (native JSON support)
- **UUID** auto-generation for primary keys
- **Full-text search** indexes on title and content
- **Automatic timestamps** via database triggers

### Database Schema

The schema is initialized via `database/init.sql`:

```sql
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

Features:
- Full-text search indexes on title and content
- JSONB index for efficient tag queries
- Auto-update trigger for `updated_at` column

## 📡 API Documentation

### Get All Responses

```http
GET /api/responses
Query params:
  - search: Optional search term (searches title, content, and tags)
```

### Get Single Response

```http
GET /api/responses/:id
```

### Create Response

```http
POST /api/responses
Content-Type: application/json

{
  "title": "string",
  "content": "string",
  "tags": ["string"]
}
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

### Connection Retry Logic

The backend automatically retries PostgreSQL connections with exponential backoff:
- Waits for database to be ready on startup
- Reconnects if connection is lost
- Maximum 5 retries with increasing delays

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
