# Rooster App - Next.js Frontend Production Dockerfile  
# DRAAD-200: FASE 2 FIX - Use npm install instead of npm ci (generate lock dynamically)
# Date: 2025-12-20T19:15:00Z
# Status: BUILD WILL GENERATE LOCKFILE AUTOMATICALLY
# DRAAD-223: CardContent export fix applied - CACHE BUST TRIGGER

FROM node:20-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Build arguments - passed from Railway at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Convert build args to environment variables for npm run build
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Copy package.json ONLY (NOT package-lock.json yet)
COPY package.json ./

# Generate lock file + install (npm install generates package-lock.json automatically)
RUN npm install --prefer-offline --legacy-peer-deps

# Copy rest of source code
COPY . .

# Build Next.js app (env vars available during build)
RUN npm run build

# ===== PRODUCTION STAGE =====
FROM node:20-alpine
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy built application from builder
COPY --from=0 /app/.next/standalone ./
COPY --from=0 /app/.next/static ./.next/static
COPY --from=0 /app/public ./public

# Expose port
EXPOSE 3000

# Health check with proper timing
HEALTHCHECK --interval=5s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "server.js"]
