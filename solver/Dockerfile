# Dockerfile voor Python FastAPI Solver Service
# Optimized voor Railway.app deployment

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

# CRITICAL FIX: Use uvicorn with PORT variable (Railway expects this)
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
