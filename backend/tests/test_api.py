"""
API Tests for Canner Backend
============================

This file contains automated tests for the Flask backend API using pytest and Playwright for Python.

Test Coverage:
- Health check endpoint
- Create, get, update, and delete operations for /api/responses

Requirements:
- pytest
- playwright (Python version)
- pytest-html (optional, for HTML reports)

How to run:
1. Start the backend server in one terminal:
    $ export DATABASE_URL=sqlite:///responses.db
    $ python app.py

2. In another terminal, run the tests:
    $ pytest tests/test_api.py

"""

import json
import pytest
from playwright.sync_api import APIRequestContext, sync_playwright

BACKEND_URL = "http://localhost:5000"  # Change if your backend runs on a different port

@pytest.fixture(scope="session")
def playwright_context():
    with sync_playwright() as p:
        request_context = p.request.new_context(base_url=BACKEND_URL)
        yield request_context
        request_context.dispose()

def test_health_check(playwright_context: APIRequestContext):
    response = playwright_context.get("/api/health")
    assert response.status == 200
    data = response.json()
    assert data["status"] == "healthy"


# Fixture to create a response and yield its ID, then clean up
@pytest.fixture
def created_response_id(playwright_context):
    payload = {
        "title": "Test Title",
        "content": "Test Content",
        "tags": ["test", "api"]
    }
    create_resp = playwright_context.post("/api/responses", data = json.dumps(payload),headers = {"Content-Type": "application/json"})
    assert create_resp.status == 201
    created = create_resp.json()
    response_id = created["id"]
    yield response_id
    # Cleanup: delete the response if it still exists
    playwright_context.delete(f"/api/responses/{response_id}")

def test_create_response(playwright_context):
    payload = {
        "title": "Test Title",
        "content": "Test Content",
        "tags": ["test", "api"]
    }
    create_resp = playwright_context.post("/api/responses", data = json.dumps(payload),headers = {"Content-Type": "application/json"})
    assert create_resp.status == 201
    created = create_resp.json()
    assert created["title"] == payload["title"]
    assert created["content"] == payload["content"]
    assert created["tags"] == payload["tags"]
    # Cleanup
    playwright_context.delete(f"/api/responses/{created['id']}")

def test_get_response(playwright_context, created_response_id):
    get_resp = playwright_context.get(f"/api/responses/{created_response_id}")
    assert get_resp.status == 200
    fetched = get_resp.json()
    assert fetched["id"] == created_response_id
    assert fetched["title"] == "Test Title"

def test_update_response(playwright_context, created_response_id):
    update_payload = {"title": "Updated Title", "content": "Updated Content", "tags": ["updated"]}
    update_resp = playwright_context.put(f"/api/responses/{created_response_id}", data = json.dumps(update_payload),headers = {"Content-Type": "application/json"})
    assert update_resp.status == 200
    updated = update_resp.json()
    assert updated["title"] == "Updated Title"
    assert updated["content"] == "Updated Content"
    assert updated["tags"] == ["updated"]

def test_delete_response(playwright_context, created_response_id):
    delete_resp = playwright_context.delete(f"/api/responses/{created_response_id}")
    assert delete_resp.status == 204
    # Confirm deletion
    get_after_delete = playwright_context.get(f"/api/responses/{created_response_id}")
    assert get_after_delete.status == 404


# Negative tests
def test_create_response_missing_fields(playwright_context):
    # Missing title
    payload = {"content": "No title"}
    resp = playwright_context.post("/api/responses", data = json.dumps(payload),headers = {"Content-Type": "application/json"})
    assert resp.status == 400
    # Missing content
    payload = {"title": "No content"}
    resp = playwright_context.post("/api/responses", data = json.dumps(payload),headers = {"Content-Type": "application/json"})
    assert resp.status == 400

def test_get_response_not_found(playwright_context):
    resp = playwright_context.get("/api/responses/nonexistent-id")
    assert resp.status == 404

def test_update_response_not_found(playwright_context):
    payload = {"title": "x", "content": "y", "tags": []}
    resp = playwright_context.put("/api/responses/nonexistent-id", data = json.dumps(payload),headers = {"Content-Type": "application/json"})
    assert resp.status == 404

def test_delete_response_not_found(playwright_context):
    resp = playwright_context.delete("/api/responses/nonexistent-id")
    assert resp.status == 404

