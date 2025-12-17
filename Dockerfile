# Rooster App - Next.js Frontend Production Dockerfile
# DRAAD-200: COMPLETE FIX - npm ci now works with package-lock.json
# Date: 2025-12-17T18:14:00Z
# Status: BUILD PIPELINE FIXED ✅

FROM node:20-alpine

# Install build dependencies for native modules
# canvg is pure JavaScript but canvas dependencies might be needed
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

WORKDIR /app

# Build arguments - passed from Railway at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Convert build args to environment variables for npm run build
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

# Copy package files (CRITICAL: package-lock.json MUST exist)
COPY package*.json ./

# Clean install with package-lock.json (reproducible builds)
RUN npm ci --prefer-offline --verbose

# Copy source code
COPY . .

# Build Next.js app (env vars available during build)
RUN npm run build

# Production stage - only needed files
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

# Start application with explicit hostname binding
CMD ["node", "server.js"]
