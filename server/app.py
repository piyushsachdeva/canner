from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import threading
from collections import defaultdict
from datetime import datetime
import statistics

app = Flask(__name__)

# Update the CORS configuration at the top of the file
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:8080", "http://127.0.0.1:8080"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# In-memory storage for request metrics
request_logs = []
endpoint_metrics = defaultdict(lambda: {
    'total_requests': 0,
    'total_latency': 0,
    'error_count': 0,
    'requests': []
})

# Lock for thread-safe operations
lock = threading.Lock()
# Middleware to track requests
@app.before_request
def track_request():
    request.start_time = time.time()

@app.after_request
def track_response(response):
    end_time = time.time()
    latency = (end_time - request.start_time) * 1000  # Convert to milliseconds
    # Skip logging metrics for CORS preflight requests
    if request.method == 'OPTIONS':
        # Normalize preflight responses to a successful empty response
        if response.status_code == 404:
            response.status_code = 204
        return response

    with lock:
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'endpoint': request.endpoint or request.path,
            'method': request.method,
            'status_code': response.status_code,
            'latency': latency
        }

        request_logs.append(log_entry)

        # Keep only last 1000 logs to prevent memory issues
        if len(request_logs) > 1000:
            request_logs.pop(0)

        # Update endpoint metrics
        endpoint_key = f"{request.method} {request.path}"
        endpoint_metrics[endpoint_key]['total_requests'] += 1
        endpoint_metrics[endpoint_key]['total_latency'] += latency
        endpoint_metrics[endpoint_key]['requests'].append({
            'timestamp': log_entry['timestamp'],
            'latency': latency,
            'status_code': response.status_code
        })

        # Keep only last 100 requests per endpoint
        if len(endpoint_metrics[endpoint_key]['requests']) > 100:
            endpoint_metrics[endpoint_key]['requests'].pop(0)

        # Count errors (status codes 4xx and 5xx)
        if response.status_code >= 400:
            endpoint_metrics[endpoint_key]['error_count'] += 1

    return response

@app.route('/health')
def health_check():
    return jsonify({
        "status": "OK",
        "timestamp": datetime.now().isoformat()
    })

# Get summarized statistics per endpoint
@app.route('/metrics')
def get_metrics():
    with lock:
        metrics_summary = {}
        for endpoint, metrics in endpoint_metrics.items():
            total_requests = metrics['total_requests']
            if total_requests > 0:
                avg_latency = metrics['total_latency'] / total_requests
                error_rate = (metrics['error_count'] / total_requests) * 100
            else:
                avg_latency = 0
                error_rate = 0
                
            metrics_summary[endpoint] = {
                'total_requests': total_requests,
                'average_latency': round(avg_latency, 2),
                'error_rate': round(error_rate, 2)
            }
        
        return jsonify(metrics_summary)

# Get recent request logs
@app.route('/metrics/recent')
def get_recent_metrics():
    with lock:
        # Return last 50 logs
        recent_logs = request_logs[-50:] if len(request_logs) > 0 else []
        return jsonify(recent_logs)

# Simple test endpoints to generate some traffic
@app.route('/')
def home():
    return jsonify({"message": "API Monitoring Dashboard Backend"})

@app.route('/test/success')
def test_success():
    return jsonify({"status": "success"})

@app.route('/test/error')
def test_error():
    return jsonify({"error": "This is a test error"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)