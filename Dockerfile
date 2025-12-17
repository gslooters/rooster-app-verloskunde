# Rooster App - Next.js Frontend
# DRAAD-200 FASE 3: Restored npm ci (best practice)
# Date: 2025-12-17T17:25:00Z
# Issue: FASE 1 used 'npm install' due to missing package-lock.json
# Solution: FASE 2 created clean package-lock.json with canvg@2.0.0 (no papandreou)
# FASE 3: Restore npm ci (best practice for production reproducible builds)

FROM node:20-alpine

WORKDIR /app

# Build arguments - passed from Railway at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Convert build args to environment variables for npm run build
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Install dependencies
# NOTE: Using 'npm ci' (best practice) - requires package-lock.json
# FASE 2 created clean package-lock.json with canvg@2.0.0
# NO papandreou@0.2.0 (papandreou-free permanent solution)
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build Next.js (env vars now available during build)
RUN npm run build

# Expose port
EXPOSE 3000

# 🔥 CRITICAL FIX: Longer healthcheck with proper timing
# Railway: start-period=60s (time to fully start)
# Railway: interval=5s (check every 5s)
# Railway: timeout=10s (wait 10s for response)
# Railway: retries=3 (try 3 times = 30s total)
HEALTHCHECK --interval=5s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Environment variables for runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Start application with explicit hostname binding
CMD ["node", ".next/standalone/server.js"]
