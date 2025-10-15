# Canner API Documentation

## Overview

The Canner API provides endpoints for managing response templates used by the AI-powered LinkedIn & Twitter assistant. This RESTful API supports full CRUD operations for response templates and includes health monitoring capabilities.

## Getting Started

### Prerequisites

- Python 3.12+
- pip (Python package manager)

### Installation

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up environment variables (optional):**
   ```bash
   export DATABASE_URL="sqlite:///responses.db"  # Default SQLite
   # OR for PostgreSQL:
   # export DATABASE_URL="postgresql://user:password@localhost:5432/canner"
   ```

3. **Run the application:**
   ```bash
   # Original app (without Swagger)
   python app.py
   
   # OR with Swagger UI documentation
   python app_with_swagger.py
   ```

### Accessing the API

- **Base URL:** `http://localhost:5000/api`
- **Swagger UI:** `http://localhost:5000/docs/` (when using `app_with_swagger.py`)
- **Health Check:** `http://localhost:5000/api/health`

## API Endpoints

### Responses

#### GET /api/responses
Get all response templates, optionally filtered by search query.

**Parameters:**
- `search` (optional): Search term to filter by title, content, or tags

**Response:**
```json
[
  {
    "id": "uuid-string",
    "title": "Professional Thank You",
    "content": "Thank you for your time and consideration...",
    "tags": ["professional", "gratitude"],
    "created_at": "2024-01-01T12:00:00Z",
    "updated_at": "2024-01-01T12:00:00Z"
  }
]
```

#### POST /api/responses
Create a new response template.

**Request Body:**
```json
{
  "title": "Response Title",
  "content": "Response content...",
  "tags": ["tag1", "tag2"]  // optional
}
```

**Response:** `201 Created`
```json
{
  "id": "generated-uuid",
  "title": "Response Title",
  "content": "Response content...",
  "tags": ["tag1", "tag2"],
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:00:00Z"
}
```

#### GET /api/responses/{id}
Get a specific response template by ID.

**Response:** `200 OK`
```json
{
  "id": "uuid-string",
  "title": "Response Title",
  "content": "Response content...",
  "tags": ["tag1", "tag2"],
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:00:00Z"
}
```

#### PUT /api/responses/{id}
Update an existing response template.

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "tags": ["updated", "tags"]
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid-string",
  "title": "Updated Title",
  "content": "Updated content...",
  "tags": ["updated", "tags"],
  "created_at": "2024-01-01T12:00:00Z",
  "updated_at": "2024-01-01T12:30:00Z"
}
```

#### DELETE /api/responses/{id}
Delete a response template.

**Response:** `204 No Content`

### Health Check

#### GET /api/health
Check the health status of the API and database connectivity.

**Response:** `200 OK` (healthy) or `503 Service Unavailable` (unhealthy)
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "database": "SQLite",
  "database_connected": true
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Service unhealthy

## Database Support

The API supports both SQLite (default) and PostgreSQL databases:

### SQLite (Default)
```bash
export DATABASE_URL="sqlite:///responses.db"
```

### PostgreSQL
```bash
export DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
```

## Development

### Running with Swagger UI

For development and testing, use the Swagger-enabled version:

```bash
python app_with_swagger.py
```

Then visit `http://localhost:5000/docs/` to access the interactive API documentation.

### Testing the API

You can test the API using curl, Postman, or the interactive Swagger UI:

```bash
# Create a response
curl -X POST http://localhost:5000/api/responses \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Response", "content": "This is a test", "tags": ["test"]}'

# Get all responses
curl http://localhost:5000/api/responses

# Search responses
curl "http://localhost:5000/api/responses?search=test"

# Health check
curl http://localhost:5000/api/health
```

## Architecture

The API is built with:
- **Flask**: Web framework
- **Flask-RESTX**: REST API framework with Swagger support
- **Flask-CORS**: Cross-origin resource sharing
- **SQLite/PostgreSQL**: Database storage
- **Marshmallow**: Data serialization and validation

## Contributing

When contributing to the API:

1. Ensure all endpoints are properly documented in Swagger
2. Add appropriate error handling and status codes
3. Update this documentation for any API changes
4. Test with both SQLite and PostgreSQL if possible

## License

This project is licensed under the MIT License.
