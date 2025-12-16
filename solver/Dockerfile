FROM python:3.12.7-slim

WORKDIR /app

# FASE 2 FIX: Cache bust for supabase package addition (2025-12-13T13:08)
ARG FASE2_CACHE_BUST=1702474000
RUN echo "[Dockerfile] FASE 2 Cache Bust: ${FASE2_CACHE_BUST}"

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

# Expose port
EXPOSE 8000

# DEBUG: Test all imports including FASE 2 SequentialSolverV2
RUN echo "[Dockerfile] Testing critical imports..." && \
    python -c "from fastapi import FastAPI; print('[OK] FastAPI imported')" && \
    python -c "import uvicorn; print('[OK] Uvicorn imported')" && \
    python -c "from ortools.linear_solver import pywraplp; print('[OK] OR-Tools imported')" && \
    python -c "from models import SolveRequest, SolveResponse; print('[OK] Models imported')" && \
    python -c "from solver_engine import RosterSolver; print('[OK] RosterSolver imported')" && \
    python -c "from supabase import create_client; print('[OK] Supabase imported')" && \
    python -c "from sequential_solver_v2 import SequentialSolverV2; print('[OK] SequentialSolverV2 imported')" && \
    python -c "from solver_selector import SolverSelectorV2; print('[OK] SolverSelectorV2 imported')" && \
    python -c "from main import app; print('[OK] Main FastAPI app imported')" && \
    echo "[Dockerfile] ✅ ALL IMPORTS SUCCESSFUL - FASE 1+2+3 COMPLETE"

# DRAAD196 FIX: Corrected healthcheck with proper shell expansion and optimized timing
# Problem was: ${PORT} not expanded in HEALTHCHECK CMD - now using hardcoded port
# Timing: Reduced start-period from 40s to 30s, interval from 30s to 5s
HEALTHCHECK --interval=5s --timeout=10s --start-period=30s --retries=6 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start server with verbose logging
CMD ["python", "-u", "-c", "import uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=8000, log_level='info')"]
