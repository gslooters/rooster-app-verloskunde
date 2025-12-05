# Dockerfile voor Python FastAPI Solver Service
# Voor Railway Deployment met Dockerfile builder
# 
# Gebruik lokaal:
#   cd solver/
#   docker build -f docker/Dockerfile -t solver .
#   docker run -p 8000:8000 solver

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (voor OR-Tools)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (voor Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Expose port
EXPOSE 8000

# Health check - removed requests dependency
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# 🔥 CRITICAL: Use JSON exec form with sh -c for environment variable expansion
# This prevents "hostname=0.0.0.0 executable not found" errors
# Railway best practice: JSON args recommended for CMD
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
