# Build stage
FROM node:20-slim AS builder

# Install Python and build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy Python requirements
COPY py_engine/requirements.txt ./py_engine/

# Install Python dependencies
RUN pip3 install --no-cache-dir -r py_engine/requirements.txt --break-system-packages

# Copy application files
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:20-slim

# Install Python runtime
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built assets and dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server
COPY --from=builder /app/py_engine ./py_engine
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/index.html ./

# Install Python dependencies in production stage
RUN pip3 install --no-cache-dir -r py_engine/requirements.txt --break-system-packages

# Create necessary directories
RUN mkdir -p /app/public/dxf /app/cache

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose the port Cloud Run expects
EXPOSE 8080

# Start the server
CMD ["node", "server/index.js"]
