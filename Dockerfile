# Rooster App - Next.js Frontend
# DRAAD-200 FASE 0: BASELINE VERIFY - Complete Docker Cache Wipe
# Date: 2025-12-17T18:50:00Z
# FIX: rm -rf node_modules + npm cache clean (explicit cache invalidation)
# Status: canvg@2.0.0 ONLY (NO canvas, NO papandreou)
# Services: rooster-app-verloskunde, Solver2, greedy all trigger

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

# 🔥 CRITICAL: Clean npm cache + remove any stale dependencies
# This prevents old canvas/papandreou from lock file being used
RUN npm cache clean --force && \
    rm -rf node_modules .npm && \
    npm install --prefer-offline --no-audit

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
