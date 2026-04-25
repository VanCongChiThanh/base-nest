# ========================================
# Multi-stage Docker build for NestJS
# ========================================

# ──── Stage 1: Build ────
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ──── Stage 2: Production ────
FROM node:22-alpine

WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy built artifacts and production dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

# Cloud Run uses PORT env variable (default 8080)
ENV PORT=8080
EXPOSE 8080

# Run as non-root user for security
RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api || exit 1

CMD ["node", "dist/main"]
