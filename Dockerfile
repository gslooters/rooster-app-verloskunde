# Rooster App - Next.js Frontend
# DRAAD185-6: FIXED - Multi-stage Dockerfile with build-time environment variables
# Root cause: Next.js static page generation at BUILD-TIME requires env vars
# Solution: ARG/ENV for build, runtime gets Railway secrets

# ============================================================================
# STAGE 1: BUILDER - Compile & generate static pages
# ============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time arguments for Next.js static generation
# These are DUMMY values - real values come from Railway secrets at runtime
ARG NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-key-for-build-time
ARG BUILD_TIMESTAMP=unknown
ARG BUILD_ID=unknown

# Set as environment variables for the build process
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NODE_ENV=production

RUN echo "[Builder] Build ID: ${BUILD_ID} Timestamp: ${BUILD_TIMESTAMP}"
RUN echo "[Builder] NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}"
RUN echo "[Builder] NODE_ENV=${NODE_ENV}"

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build Next.js (static generation happens here with dummy env vars)
RUN npm run build

# ============================================================================
# STAGE 2: RUNTIME - Production server
# ============================================================================
FROM node:20-alpine

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose port
EXPOSE 3000

# Health check with longer timeout for startup
# Build + startup can be slow with Railway's resources
HEALTHCHECK --interval=10s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Runtime environment variables
# These will be injected by Railway at deployment time
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Start server
CMD ["node", "server.js"]