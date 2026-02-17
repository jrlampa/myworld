# Multi-stage Dockerfile for SIS RUA Unified Application
# Optimized for Cloud Run deployment with security best practices

# Stage 1: Frontend build
FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app

# Copy dependency files first for better layer caching
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source and build frontend
COPY . .
RUN npm run build

# Stage 2: Backend build
FROM node:22-bookworm-slim AS backend-build
WORKDIR /app

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

COPY tsconfig*.json ./
COPY server ./server
RUN npx tsc -p tsconfig.server.json

# Stage 3: Production runner (Python + Node.js)
FROM ubuntu:24.04
WORKDIR /app

# Security: Run as non-root user
RUN useradd -m -u 1000 appuser

# Environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install Node.js and Python with minimal packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        python3 \
        python3-pip \
        python3-venv && \
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

# Setup Python virtual environment and install dependencies
COPY py_engine/requirements.txt ./py_engine/
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r py_engine/requirements.txt

# Copy application files
COPY py_engine ./py_engine
COPY public ./public
COPY --from=frontend-build /app/dist ./dist
COPY --from=backend-build /app/dist/server ./server/dist

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

# Start application
CMD ["node", "server/dist/server/index.js"]
