FROM python:3.12.7-slim

WORKDIR /app

# DRAAD208C: Database validation boot + enhanced error handling
ARG DRAAD208C_CACHE_BUST=1734545400
RUN echo "[Dockerfile] DRAAD208C Cache Bust: ${DRAAD208C_CACHE_BUST}"

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
ENV FASE2_STATUS=COMPLETE
ENV DRAAD208C_VALIDATION_BOOT=enabled

# Expose port
EXPOSE 8000

# DEBUG: Test all imports including FASE 2 SequentialSolverV2 + DRAAD208C validation
RUN echo "[Dockerfile] Testing critical imports..." && \
    python -c "from fastapi import FastAPI; print('[OK] FastAPI imported')" && \
    python -c "import uvicorn; print('[OK] Uvicorn imported')" && \
    python -c "from ortools.linear_solver import pywraplp; print('[OK] OR-Tools imported')" && \
    python -c "from models import SolveRequest, SolveResponse; print('[OK] Models imported')" && \
    python -c "from solver_engine import RosterSolver; print('[OK] RosterSolver imported')" && \
    python -c "from supabase import create_client; print('[OK] Supabase imported')" && \
    python -c "from sequential_solver_v2 import SequentialSolverV2; print('[OK] SequentialSolverV2 imported')" && \
    python -c "from solver_selector import SolverSelectorV2; print('[OK] SolverSelectorV2 imported')" && \
    python -c "from main import app; print('[OK] Main FastAPI app imported - DRAAD208C boot included')" && \
    echo "[Dockerfile] ALL IMPORTS SUCCESSFUL - FASE 1+2+3 + DRAAD208C COMPLETE"

# DRAAD208C FIX3: Enhanced health check with validation status
# Checks both /health endpoint (standard health)
# Also used by connection validation in solve-greedy/route.ts
HEALTHCHECK --interval=5s --timeout=10s --start-period=30s --retries=6 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start server with verbose logging
# DRAAD208C: Database validation boot runs automatically on startup in main.py
CMD ["python", "-u", "-c", "import uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=8000, log_level='info')"]
