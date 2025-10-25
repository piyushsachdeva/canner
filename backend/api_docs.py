"""
API Documentation for Canner Backend
Provides OpenAPI/Swagger documentation
"""

from flask import Blueprint, jsonify
from flask_swagger_ui import get_swaggerui_blueprint

# Create blueprint for API docs
api_docs_bp = Blueprint('api_docs', __name__)

# Swagger UI configuration
SWAGGER_URL = '/api/docs'
API_URL = '/api/swagger.json'

swagger_ui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,
    API_URL,
    config={
        'app_name': "Canner API",
        'layout': "BaseLayout",
        'deepLinking': True
    }
)

@api_docs_bp.route('/swagger.json')
def swagger_spec():
    """Return OpenAPI specification"""
    spec = {
        "openapi": "3.0.0",
        "info": {
            "title": "Canner API",
            "description": "AI-powered response management system for social media platforms. Powered by Groq AI for ultra-fast response generation.",
            "version": "1.0.0",
            "contact": {
                "name": "Canner Team",
                "email": "support@canner.dev"
            }
        },
        "servers": [
            {
                "url": "http://localhost:5000",
                "description": "Development server"
            }
        ],
        "paths": {
            "/api/responses": {
                "get": {
                    "summary": "Get all responses",
                    "description": "Retrieve all saved responses with optional search filtering",
                    "parameters": [
                        {
                            "name": "search",
                            "in": "query",
                            "description": "Search term for filtering responses",
                            "required": False,
                            "schema": {"type": "string"}
                        },
                        {
                            "name": "platform",
                            "in": "query", 
                            "description": "Filter by platform (linkedin, twitter, etc.)",
                            "required": False,
                            "schema": {"type": "string"}
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "List of responses",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "array",
                                        "items": {"$ref": "#/components/schemas/Response"}
                                    }
                                }
                            }
                        },
                        "429": {
                            "description": "Rate limit exceeded"
                        }
                    }
                },
                "post": {
                    "summary": "Create new response",
                    "description": "Create a new saved response",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/CreateResponse"}
                            }
                        }
                    },
                    "responses": {
                        "201": {
                            "description": "Response created successfully",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/Response"}
                                }
                            }
                        },
                        "400": {
                            "description": "Invalid input data"
                        }
                    }
                }
            },
            "/api/responses/{id}": {
                "get": {
                    "summary": "Get response by ID",
                    "parameters": [
                        {
                            "name": "id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"}
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Response details",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/Response"}
                                }
                            }
                        },
                        "404": {
                            "description": "Response not found"
                        }
                    }
                },
                "put": {
                    "summary": "Update response",
                    "parameters": [
                        {
                            "name": "id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"}
                        }
                    ],
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/UpdateResponse"}
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Response updated successfully"
                        },
                        "404": {
                            "description": "Response not found"
                        }
                    }
                },
                "delete": {
                    "summary": "Delete response",
                    "parameters": [
                        {
                            "name": "id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"}
                        }
                    ],
                    "responses": {
                        "204": {
                            "description": "Response deleted successfully"
                        },
                        "404": {
                            "description": "Response not found"
                        }
                    }
                }
            },
            "/api/suggestions": {
                "post": {
                    "summary": "Get AI suggestions",
                    "description": "Generate AI-powered response suggestions based on context using Groq's ultra-fast LLMs",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/SuggestionRequest"}
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "AI suggestions generated",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/SuggestionResponse"}
                                }
                            }
                        },
                        "503": {
                            "description": "AI service not available"
                        }
                    }
                }
            },
            "/api/suggestions/async": {
                "post": {
                    "summary": "Get AI suggestions asynchronously",
                    "description": "Submit AI suggestion generation as background task",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": "#/components/schemas/SuggestionRequest"}
                            }
                        }
                    },
                    "responses": {
                        "202": {
                            "description": "Task submitted successfully",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/TaskResponse"}
                                }
                            }
                        }
                    }
                }
            },
            "/api/analytics/usage": {
                "get": {
                    "summary": "Get usage analytics",
                    "description": "Retrieve usage analytics and statistics",
                    "parameters": [
                        {
                            "name": "days",
                            "in": "query",
                            "description": "Number of days to analyze",
                            "required": False,
                            "schema": {"type": "integer", "default": 30}
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Analytics data",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/AnalyticsResponse"}
                                }
                            }
                        }
                    }
                }
            },
            "/api/tasks/{task_id}": {
                "get": {
                    "summary": "Get task status",
                    "description": "Check the status of a background task",
                    "parameters": [
                        {
                            "name": "task_id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"}
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Task status",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/TaskStatus"}
                                }
                            }
                        }
                    }
                },
                "delete": {
                    "summary": "Cancel task",
                    "description": "Cancel a running background task",
                    "parameters": [
                        {
                            "name": "task_id",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string"}
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Task cancelled successfully"
                        },
                        "400": {
                            "description": "Failed to cancel task"
                        }
                    }
                }
            },
            "/api/health": {
                "get": {
                    "summary": "Health check",
                    "description": "Check API and service health status",
                    "responses": {
                        "200": {
                            "description": "Service is healthy",
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/HealthResponse"}
                                }
                            }
                        },
                        "503": {
                            "description": "Service is unhealthy"
                        }
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "Response": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string", "format": "uuid"},
                        "title": {"type": "string"},
                        "content": {"type": "string"},
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "created_at": {"type": "string", "format": "date-time"},
                        "updated_at": {"type": "string", "format": "date-time"}
                    }
                },
                "CreateResponse": {
                    "type": "object",
                    "required": ["title", "content"],
                    "properties": {
                        "title": {"type": "string"},
                        "content": {"type": "string"},
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    }
                },
                "UpdateResponse": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "content": {"type": "string"},
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    }
                },
                "SuggestionRequest": {
                    "type": "object",
                    "required": ["platform"],
                    "properties": {
                        "platform": {
                            "type": "string",
                            "enum": ["linkedin", "twitter", "github", "discord"]
                        },
                        "conversation_text": {"type": "string"},
                        "user_input": {"type": "string"},
                        "tone": {
                            "type": "string",
                            "enum": ["professional", "casual", "friendly", "formal"],
                            "default": "professional"
                        },
                        "max_length": {"type": "integer", "default": 280}
                    }
                },
                "SuggestionResponse": {
                    "type": "object",
                    "properties": {
                        "suggestions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "content": {"type": "string"},
                                    "confidence": {"type": "number"},
                                    "tone": {"type": "string"},
                                    "platform": {"type": "string"}
                                }
                            }
                        },
                        "context": {
                            "type": "object",
                            "properties": {
                                "platform": {"type": "string"},
                                "tone": {"type": "string"},
                                "max_length": {"type": "integer"}
                            }
                        }
                    }
                },
                "TaskResponse": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string"},
                        "status": {"type": "string"},
                        "check_url": {"type": "string"}
                    }
                },
                "TaskStatus": {
                    "type": "object",
                    "properties": {
                        "task_id": {"type": "string"},
                        "status": {
                            "type": "string",
                            "enum": ["pending", "running", "success", "failure", "timeout"]
                        },
                        "result": {"type": "object"},
                        "error": {"type": "string"},
                        "created_at": {"type": "string", "format": "date-time"},
                        "completed_at": {"type": "string", "format": "date-time"}
                    }
                },
                "AnalyticsResponse": {
                    "type": "object",
                    "properties": {
                        "period_days": {"type": "integer"},
                        "overview": {"type": "object"},
                        "top_responses": {"type": "array"},
                        "platform_breakdown": {"type": "array"},
                        "usage_trends": {"type": "array"},
                        "tag_analytics": {"type": "array"},
                        "generated_at": {"type": "string", "format": "date-time"}
                    }
                },
                "HealthResponse": {
                    "type": "object",
                    "properties": {
                        "status": {"type": "string"},
                        "timestamp": {"type": "string", "format": "date-time"},
                        "database": {"type": "string"},
                        "database_connected": {"type": "boolean"},
                        "ai_service_available": {"type": "boolean"},
                        "features": {
                            "type": "object",
                            "properties": {
                                "ai_suggestions": {"type": "boolean"},
                                "smart_search": {"type": "boolean"},
                                "analytics": {"type": "boolean"}
                            }
                        }
                    }
                }
            }
        }
    }
    
    return jsonify(spec)