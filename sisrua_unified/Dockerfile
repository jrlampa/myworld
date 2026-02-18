# Multi-stage Dockerfile for SIS RUA Unified Application
# Optimized for Cloud Run deployment with security best practices

# Stage 1: Build (Frontend + Backend + Python)
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install Python build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv build-essential && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency files first for better layer caching
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source and build both frontend and backend
COPY . .
RUN npm run build

# Build backend separately to ensure it's compiled
RUN npx tsc -p tsconfig.server.json

# Setup Python venv in builder to reuse in production
COPY py_engine/requirements.txt ./py_engine/
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /opt/venv/bin/pip install --no-cache-dir -r py_engine/requirements.txt && \
    apt-get purge -y --auto-remove build-essential python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Stage 2: Production runner (Python + Node.js)
FROM ubuntu:24.04
WORKDIR /app

# Security: Run as non-root user
RUN useradd -m -u 10000 appuser

# Environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHON_COMMAND=python3 \
    DOCKER_ENV=true

# Install Node.js and Python runtime (single installation)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        python3 && \
    # Add NodeSource repository for Node.js 22
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    # Cleanup
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Install Node.js production dependencies
COPY package*.json ./
RUN npm ci --only=production --prefer-offline --no-audit && \
    npm cache clean --force

# Copy pre-built Python venv from builder (avoids duplicate pip install)
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application files
COPY py_engine ./py_engine
COPY public ./public
COPY --from=builder /app/dist ./dist

# Create directories for runtime data
RUN mkdir -p /app/public/dxf /app/cache && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Expose port
EXPOSE 8080

# FIXED: Correct path to compiled server code (dist/server/server/index.js)
CMD ["node", "dist/server/server/index.js"]
