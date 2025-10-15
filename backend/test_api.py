#!/usr/bin/env python3
"""
Simple test script for the Canner API
"""
import requests
import json
import sys

BASE_URL = "http://localhost:5001/api"

def test_health():
    """Test the health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_create_response():
    """Test creating a response"""
    print("\n📝 Testing create response...")
    data = {
        "title": "Test Response",
        "content": "This is a test response for API documentation",
        "tags": ["test", "api", "documentation"]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/responses", json=data)
        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")
        return result.get('id') if response.status_code == 201 else None
    except Exception as e:
        print(f"❌ Create response failed: {e}")
        return None

def test_get_responses():
    """Test getting all responses"""
    print("\n📋 Testing get all responses...")
    try:
        response = requests.get(f"{BASE_URL}/responses")
        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Found {len(result)} responses")
        if result:
            print(f"First response: {json.dumps(result[0], indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Get responses failed: {e}")
        return False

def test_get_response(response_id):
    """Test getting a specific response"""
    if not response_id:
        print("\n⚠️  Skipping get specific response (no ID available)")
        return False
        
    print(f"\n🔍 Testing get response {response_id}...")
    try:
        response = requests.get(f"{BASE_URL}/responses/{response_id}")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Response: {json.dumps(result, indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Get response failed: {e}")
        return False

def test_update_response(response_id):
    """Test updating a response"""
    if not response_id:
        print("\n⚠️  Skipping update response (no ID available)")
        return False
        
    print(f"\n✏️  Testing update response {response_id}...")
    data = {
        "title": "Updated Test Response",
        "content": "This response has been updated via API",
        "tags": ["test", "api", "updated"]
    }
    
    try:
        response = requests.put(f"{BASE_URL}/responses/{response_id}", json=data)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Response: {json.dumps(result, indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Update response failed: {e}")
        return False

def test_search_responses():
    """Test searching responses"""
    print("\n🔍 Testing search responses...")
    try:
        response = requests.get(f"{BASE_URL}/responses?search=test")
        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Found {len(result)} responses matching 'test'")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Search responses failed: {e}")
        return False

def test_delete_response(response_id):
    """Test deleting a response"""
    if not response_id:
        print("\n⚠️  Skipping delete response (no ID available)")
        return False
        
    print(f"\n🗑️  Testing delete response {response_id}...")
    try:
        response = requests.delete(f"{BASE_URL}/responses/{response_id}")
        print(f"Status: {response.status_code}")
        return response.status_code == 204
    except Exception as e:
        print(f"❌ Delete response failed: {e}")
        return False

def main():
    """Run all API tests"""
    print("🚀 Starting Canner API Tests")
    print("=" * 50)
    
    # Test health first
    if not test_health():
        print("❌ API is not healthy. Make sure the server is running.")
        sys.exit(1)
    
    # Test CRUD operations
    response_id = test_create_response()
    test_get_responses()
    test_get_response(response_id)
    test_update_response(response_id)
    test_search_responses()
    test_delete_response(response_id)
    
    print("\n" + "=" * 50)
    print("✅ API tests completed!")
    print("📚 To view interactive documentation, visit:")
    print("   http://localhost:5001/docs/")

if __name__ == "__main__":
    main()
