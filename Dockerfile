# Dockerfile voor Railway deployment
# Dit lost de persistent volume cache issue op

# Stage 1: Dependencies
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Kopieer package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Kopieer dependencies van deps stage
COPY --from=deps /app/node_modules ./node_modules

# Kopieer alle source code
COPY . .

# Verwijder explici et .next folder als die zou bestaan
RUN rm -rf .next || true

# Build de applicatie (met alle dependencies)
RUN npm install && npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Kopieer alleen wat nodig is voor runtime
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose port
EXPOSE 8080

ENV PORT=8080

# Start de applicatie
CMD ["npm", "start"]
