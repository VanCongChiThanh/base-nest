# ──── Production ────
FROM node:22-alpine

WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Copy built artifacts and production dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

ENV PORT=3000
EXPOSE 3000

# Run as non-root user for security
RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001
USER nestjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api || exit 1

CMD ["node", "dist/main.js"]