# Rooster App - Next.js Frontend
# DRAAD186: Fixed Docker build with proper environment variable injection
# Date: 2025-12-15T20:04:00Z
# Issue: Build args needed for NEXT_PUBLIC_* variables during docker build

FROM node:20-alpine

WORKDIR /app

# Build arguments - passed from Railway at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Convert build args to environment variables for npm run build
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Install dependencies
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build Next.js (env vars now available during build)
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Environment variables for runtime
ENV NODE_ENV=production
ENV PORT=3000

# Start application
CMD node .next/standalone/server.js
