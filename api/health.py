# File: backend/api/health.py

from flask import Blueprint, jsonify, current_app
import time

health = Blueprint('health', __name__)

@health.route('/health', methods=['GET'])
def health_check():
    """
    Simple health check endpoint.
    Returns basic status and optionally server metrics.
    """
    start = time.time()
    # You can add more checks here: DB, external API, cache, etc.
    status = {
        "status": "ok",
        "timestamp": int(time.time()),
        "uptime_seconds": int(time.time() - current_app.config.get("START_TIME", time.time())),
    }
    elapsed = (time.time() - start) * 1000  # ms
    status["response_time_ms"] = round(elapsed, 2)
    return jsonify(status), 200
