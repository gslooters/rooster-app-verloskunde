# DRAAD102D: Multi-stage Dockerfile voor Railway deployment
# Python 3.12.7 + Node.js 20 + FastAPI + Next.js Static Export
# Critical: Python 3.13 heeft geen psycopg2-binary wheels, 3.12 wel!

# ============================================================
# STAGE 1: Node.js builder voor Next.js frontend
# ============================================================
FROM node:20-slim AS node-builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install Node dependencies
RUN npm ci --no-audit --no-fund

# Copy Next.js source
COPY next.config.js ./
COPY tsconfig.json ./
COPY postcss.config.js ./
COPY tailwind.config.ts ./
COPY src ./src
COPY public ./public

# Build Next.js static export
ENV NODE_ENV=production
RUN npm run build

# ============================================================
# STAGE 2: Python 3.12.7 runtime met FastAPI
# ============================================================
FROM python:3.12.7-slim AS runtime

# Install system dependencies
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python requirements
COPY requirements.txt ./

# Upgrade pip en install Python dependencies
# Python 3.12 heeft wheels voor ALLE packages:
# - psycopg2-binary 2.9.9 heeft cp312 wheels
# - ortools 9.14.6206 heeft cp312 wheels
RUN python3.12 -m pip install --upgrade pip && \
    python3.12 -m pip install --no-cache-dir -r requirements.txt

# Copy FastAPI application
COPY main.py ./

# Copy Next.js static build from node-builder stage
COPY --from=node-builder /app/out ./out

# Expose port (Railway sets $PORT dynamically)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Start FastAPI with uvicorn
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}