# Dockerfile voor Python FastAPI Solver Service
# Voor Railway Deployment met Dockerfile builder
# 
# RAILWAY DEPLOYMENT:
#   - Dit bestand MOET in solver/ root staan (niet in submap)
#   - Railway root_dir=solver zoekt naar solver/Dockerfile
#   - Build context is solver/ directory

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

# Install Python dependencies with VERBOSE output
# DRAAD112: -v flag voor zichtbare pip errors
RUN pip install --no-cache-dir --upgrade pip -v && \
    echo "=== INSTALLING REQUIREMENTS ===" && \
    pip install --no-cache-dir -r requirements.txt -v && \
    echo "=== VERIFYING UVICORN ===" && \
    which uvicorn && \
    uvicorn --version && \
    echo "=== UVICORN VERIFIED ===" || \
    (echo "ERROR: uvicorn not found after pip install!" && exit 1)

# Copy application code
COPY . .

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV PATH="/usr/local/bin:${PATH}"

# Expose port
EXPOSE 8000

# Health check - removed requests dependency
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# DRAAD112: Direct uvicorn call (not via sh -c)
# Railway sets PORT env var automatically
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]