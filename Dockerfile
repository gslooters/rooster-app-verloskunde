# Rooster App - Next.js Frontend
# DRAAD-200: EMERGENCY FIX - npm install (package-lock.json missing)
# Date: 2025-12-17T18:04:00Z
# Status: Generate clean package-lock.json in container
# Services: rooster-app-verloskunde, Solver2, greedy all rebuilding

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

# CRITICAL FIX: npm install generates fresh package-lock.json
# package-lock.json is NOT in repo - this generates it cleanly in container
# No papandreou corruption possible (not in npm registry)
RUN npm install --prefer-offline --no-audit

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
