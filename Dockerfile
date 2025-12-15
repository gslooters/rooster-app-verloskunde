# Rooster App - Next.js Frontend
# DRAAD187: Stable baseline Dockerfile (reverted from DRAAD186 broken version)
# Date: 2025-12-15T20:36:00Z
# Status: Known working configuration

FROM node:20-alpine

WORKDIR /app

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

# Start application
# Simple command form - Railway will set HOSTNAME=0.0.0.0 via environment
CMD node .next/standalone/server.js
