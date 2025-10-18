# API Monitoring Dashboard - Backend

This is the Flask backend for the API Monitoring Dashboard. It tracks every request's endpoint name, HTTP method, response status code, and response time (latency in ms).

## Features

- Tracks all HTTP requests with latency metrics
- Provides summarized statistics per endpoint
- Offers health check endpoint with global error rate
- Stores metrics in memory (no external database required)

## Endpoints

- `GET /health` - Returns "OK" if global error rate is under 10%, otherwise "DEGRADED"
- `GET /metrics` - Returns summarized statistics per endpoint (total requests, average latency, error rate)
- `GET /metrics/recent` - Returns recent request logs
- `/test/success` - Test endpoint that returns a success response
- `/test/error` - Test endpoint that returns an error response

## Setup

1. Navigate to the server directory:

   ```
   cd server
   ```

2. Install dependencies:

   ```
   pip install -r requirements.txt
   ```

3. Run the server:

   ```
   python app.py
   ```

4. The server will start on `http://localhost:5000`

## How it works

The backend uses Flask middleware to track all incoming requests:

- `@app.before_request` captures the start time of each request
- `@app.after_request` calculates latency and stores metrics
- All metrics are stored in memory using Python dictionaries
- Thread-safe operations using locks to prevent race conditions

## Data Structure

### Health Endpoint Response

```json
{
  "status": "OK",
  "total_requests": 42,

  "error_rate": 2.38
}
```

### Metrics Endpoint Response

```json
{
  "GET /api/users": {
    "total_requests": 25,
    "average_latency": 42.5,
    "error_rate": 0.0
  },
  "POST /api/users": {
    "total_requests": 12,
    "average_latency": 125.3,

    "error_rate": 8.33
  }
}
```

### Recent Metrics Endpoint Response

```json
[
  {
   
 "timestamp": "2023-10-15T10:30:45.123456",
    "endpoint": "get_metrics",
    "method": "GET",
    "status_code": 200,
    "latency": 42.5
  }
]
```
