# Rooster App - Next.js Frontend
# DRAAD185 ROOT CAUSE FIX: Explicit Dockerfile to prevent Railpack ambiguity
# Date: 2025-12-15T18:46:00Z
# Issue: Railway auto-detection confused by both Node.js and Python artifacts
# Solution: Explicit Dockerfile forces Node.js path, ignores solver/requirements.txt

FROM node:20-alpine

WORKDIR /app

# Build arguments for cache busting
ARG BUILD_TIMESTAMP=unknown
ARG BUILD_ID=unknown
RUN echo "[Dockerfile] Build ID: ${BUILD_ID} Timestamp: ${BUILD_TIMESTAMP}"

# Install dependencies
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Start server with verbose logging
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", ".next/standalone/server.js"]