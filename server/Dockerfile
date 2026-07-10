# ========== Stage 1: Build Frontend ==========
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npx vite build

# ========== Stage 2: Production Server ==========
FROM node:20-alpine
WORKDIR /app

# Install ffmpeg for audio format conversion (voice input)
RUN apk add --no-cache ffmpeg

# Install server dependencies (including dev for Prisma CLI)
COPY server/package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY server/prisma ./prisma
RUN npx prisma generate

# Copy server source and fonts
COPY server/src ./src
COPY server/fonts ./fonts

# Copy built frontend as static files
COPY --from=frontend-build /app/frontend/dist ./public

# Create data directory for SQLite + logs
RUN mkdir -p /app/data /app/data/logs

# Environment defaults
ENV DATABASE_URL="file:/app/data/prod.db"
ENV PORT=3000
ENV NODE_ENV=production

# Entrypoint: migrate + seed + start
COPY server/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "const h=require('http');h.get('http://localhost:3000/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
