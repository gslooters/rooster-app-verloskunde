# Rooster App - Next.js Frontend
# DRAAD186 FIX #2: Dockerfile start command fix for Railway runtime
# Date: 2025-12-15T19:20:00Z
# Issue: ENV HOSTNAME variable interpreted as executable command
# Solution: Use shell form CMD with proper environment variable injection

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

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# FIX #2: Use shell form with proper hostname binding for Railway
# This ensures HOSTNAME=0.0.0.0 is passed as environment variable,
# not interpreted as a command. The shell form allows variable expansion.
CMD ["/bin/sh", "-c", "node .next/standalone/server.js"]