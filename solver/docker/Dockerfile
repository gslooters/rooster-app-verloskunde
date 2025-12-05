# Dockerfile voor Python FastAPI Solver Service
# Voor Railway Deployment met Dockerfile builder
# 
# RAILWAY DEPLOYMENT:
#   - Railway verwacht Dockerfile op solver/docker/Dockerfile
#   - Build context is solver/ directory
#   - COPY commando's zijn relatief aan solver/

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (voor OR-Tools)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (voor Docker layer caching)
# Pad is relatief aan build context (solver/)
COPY requirements.txt .

# Install Python dependencies
# DRAAD113: --root-user-action=ignore voor pip 25.3 compatibility
# Docker containers MOETEN als root draaien - dit is safe in container context
RUN pip install --no-cache-dir --upgrade pip -v && \
    echo "=== INSTALLING REQUIREMENTS ===" && \
    pip install --no-cache-dir --root-user-action=ignore -r requirements.txt -v && \
    echo "=== VERIFYING INSTALLATIONS ===" && \
    python -c "import fastapi; print(f'✓ FastAPI {fastapi.__version__}')" && \
    python -c "import uvicorn; print(f'✓ Uvicorn {uvicorn.__version__}')" && \
    python -c "import ortools; print(f'✓ OR-Tools {ortools.__version__}')" && \
    which uvicorn && \
    uvicorn --version && \
    echo "=== ALL DEPENDENCIES VERIFIED ==="

# Copy application code
# Kopieert alle files uit solver/ naar container /app
COPY . .

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV PATH="/usr/local/bin:${PATH}"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Start uvicorn server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]