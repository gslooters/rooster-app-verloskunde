# Rooster App - Next.js Frontend
# DRAAD-200: COMPLETE ROLLBACK TO BASELINE
# Date: 2025-12-17T18:00:00Z
# Status: All 3 services reset + Docker cache flushed
# FIX: npm ci restored (from baseline commit)
# Services: rooster-app-verloskunde, Solver2, greedy aligned

FROM node:20-alpine

WORKDIR /app

# Build arguments - passed from Railway at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Convert build args to environment variables for npm run build
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Copy package files
COPY package*.json ./

# Use npm ci for reproducible builds (requires package-lock.json)
# npm ci is best practice for production environments
RUN npm ci --prefer-offline

# Copy source code
COPY . .

# Build Next.js (env vars now available during build)
RUN npm run build

# Expose port
EXPOSE 3000

# Healthcheck with proper timing
HEALTHCHECK --interval=5s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Environment variables for runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Start application with explicit hostname binding
CMD ["node", ".next/standalone/server.js"]
