# -------------------- Base Image -------------------- #
FROM python:3.12-slim

# -------------------- Working Directory -------------------- #
WORKDIR /app

# -------------------- System Dependencies -------------------- #
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    git \
    curl \
    wget \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# -------------------- Copy Requirements -------------------- #
COPY requirements.txt .

# -------------------- Python Dependencies -------------------- #
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# -------------------- Copy App Code -------------------- #
COPY app.py database.py models.py ./ 
# Add any other modules or directories as needed
# COPY utils/ ./utils/

# -------------------- Create Non-Root User -------------------- #
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# -------------------- Expose Flask Port -------------------- #
EXPOSE 5000

# -------------------- Health Check -------------------- #
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# -------------------- Run Application -------------------- #
CMD ["python", "app.py"]
