"""
API Models for Swagger Documentation
"""
from flask_restx import fields, Model

def create_api_models(api):
    """Create and register API models for documentation"""
    
    # Response model
    response_model = api.model('Response', {
        'id': fields.String(required=True, description='Unique identifier for the response'),
        'title': fields.String(required=True, description='Title of the response'),
        'content': fields.String(required=True, description='Content of the response'),
        'tags': fields.List(fields.String, description='List of tags associated with the response'),
        'created_at': fields.String(description='Timestamp when the response was created'),
        'updated_at': fields.String(description='Timestamp when the response was last updated')
    })
    
    # Request models
    create_response_model = api.model('CreateResponse', {
        'title': fields.String(required=True, description='Title of the response'),
        'content': fields.String(required=True, description='Content of the response'),
        'tags': fields.List(fields.String, description='List of tags associated with the response', default=[])
    })
    
    update_response_model = api.model('UpdateResponse', {
        'title': fields.String(description='Title of the response'),
        'content': fields.String(description='Content of the response'),
        'tags': fields.List(fields.String, description='List of tags associated with the response')
    })
    
    # Health check model
    health_model = api.model('Health', {
        'status': fields.String(required=True, description='Health status'),
        'timestamp': fields.String(required=True, description='Current timestamp'),
        'database': fields.String(required=True, description='Database type being used'),
        'database_connected': fields.Boolean(required=True, description='Database connection status'),
        'error': fields.String(description='Error message if unhealthy')
    })
    
    # Error model
    error_model = api.model('Error', {
        'error': fields.String(required=True, description='Error message')
    })
    
    return {
        'response': response_model,
        'create_response': create_response_model,
        'update_response': update_response_model,
        'health': health_model,
        'error': error_model
    }
