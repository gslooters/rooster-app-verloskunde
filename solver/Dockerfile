FROM python:3.12.7-slim

WORKDIR /app

# DRAAD170: Cache bust argument for Railway deployment
ARG DRAAD170_CACHE_BUST=0
RUN echo "[Dockerfile] DRAAD170 Cache Bust: ${DRAAD170_CACHE_BUST}"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --root-user-action=ignore -r requirements.txt

# Copy application code
COPY . .

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
ENV DRAAD170_PHASE_1=constraint7_validation+constraint8_reification
ENV DRAAD170_PHASE_2=async_await+threadpoolexecutor

# Expose port
EXPOSE 8000

# DEBUG: Test imports before starting service
RUN echo "[Dockerfile] Testing critical imports..." && \
    python -c "from fastapi import FastAPI; print('[OK] FastAPI imported')" && \
    python -c "import uvicorn; print('[OK] Uvicorn imported')" && \
    python -c "from ortools.linear_solver import pywraplp; print('[OK] OR-Tools imported')" && \
    python -c "from models import SolveRequest, SolveResponse; print('[OK] Models imported')" && \
    python -c "from solver_engine import RosterSolver; print('[OK] RosterSolver imported')" && \
    python -c "from main import app; print('[OK] Main FastAPI app imported')" && \
    echo "[Dockerfile] All imports successful - container ready for DRAAD170 fixes"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Start server with verbose logging
CMD ["python", "-u", "-c", "import uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=8000, log_level='info')"]
