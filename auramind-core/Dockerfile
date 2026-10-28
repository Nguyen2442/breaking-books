# ==============================================================================
# Multi-Stage Dockerfile for AuraMind NestJS Backend
# Optimized for minimal footprint (<180MB), non-root execution, and fast startup
# ==============================================================================

# ----------------- Stage 1: Dependencies & Build -----------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build tools needed for native node-gyp bindings if any
RUN apk add --no-cache libc6-compat python3 make g++

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for TypeScript compilation)
RUN npm ci

# Copy entire source code
COPY . .

# Generate Prisma Client bindings
RUN npx prisma generate

# Build TypeScript to production JavaScript in dist/
RUN npm run build

# Prune devDependencies to keep node_modules minimal for production stage
RUN npm prune --production

# ----------------- Stage 2: Production Runtime -----------------
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Install dumb-init for proper PID 1 signal forwarding (SIGTERM / graceful shutdown)
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
ENV PORT=4000

# Copy minimal runtime files from builder stage
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/prisma ./prisma
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./

# Switch to non-root user 'node' for security compliance
USER node

EXPOSE 4000

# Use dumb-init to orchestrate container lifecycle and graceful BullMQ draining
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/main.js"]
