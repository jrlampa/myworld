# Docker Guide

This document covers Docker setup, usage, and troubleshooting for the SIS RUA application.

## Architecture

SIS RUA uses a **Docker-first** architecture for production deployment, with a multi-stage Dockerfile:

```
Stage 1: frontend-build
  └── Vite/React bundling

Stage 2: builder
  └── TypeScript compilation + Python venv setup

Stage 3: production
  └── Node.js 22 + Python venv (copied from builder)
      └── Non-root user (appuser, UID 10000)
      └── Health check endpoint
```

### Python Integration

In production, Python runs natively in the container — **no .exe files**:

```typescript
// Always uses Python directly (Docker-first)
const pythonCommand = process.env.PYTHON_COMMAND || 'python3';
const command = pythonCommand;
const args = [scriptPath];
```

Benefits over the old `.exe` approach:
- ✅ No antivirus false positives
- ✅ Simpler code (73% reduction in pythonBridge.ts)
- ✅ Works in any environment (Docker, CI/CD, Cloud Run)
- ✅ Python venv pre-built in builder stage — ~30-40% faster builds

## Quick Start

### Prerequisites

- Docker Desktop installed
- Docker Compose included (comes with Docker Desktop)

### Run with Docker Compose

```bash
cd sisrua_unified

# Start all services
docker compose up

# Access the application
# http://localhost:8080
```

Services started:
- ✅ Node.js 22 backend
- ✅ Python 3 + all dependencies (osmnx, ezdxf, geopandas)
- ✅ React/Vite frontend
- ✅ All DXF generation capabilities

### Stop

```bash
docker compose down

# Remove volumes (clears DXF files and cache)
docker compose down -v
```

## Common Commands

### Build

```bash
# Build production image
docker build -t sisrua-app .

# Build with no cache (full rebuild)
docker build --no-cache -t sisrua-app .
```

### Run Container

```bash
docker run -p 8080:8080 \
  -e GROQ_API_KEY=your_key \
  -e GCP_PROJECT=sisrua-producao \
  -e CLOUD_TASKS_LOCATION=southamerica-east1 \
  -e CLOUD_TASKS_QUEUE=sisrua-queue \
  -e NODE_ENV=production \
  sisrua-app
```

### Logs

```bash
# All service logs
docker compose logs -f

# Application logs only
docker compose logs -f app

# Last 100 lines
docker compose logs --tail=100 app
```

### Interactive Shell

```bash
# Open shell in running container
docker compose exec app bash

# Test Python dependencies
docker compose exec app python3 -c "import osmnx, ezdxf, geopandas; print('OK')"

# Run Python engine manually
docker compose exec app python3 py_engine/main.py --help
```

## Developer Experience

### Before Docker (Old Workflow)

```bash
1. Install Node.js 22
2. Install Python 3.9+
3. npm install
4. pip install -r requirements.txt
5. Configure environment variables
6. npm run dev
```

### After Docker (Current)

```bash
docker compose up
# Done! Everything starts automatically
```

## Docker Build Troubleshooting

### ModuleNotFoundError: No module named 'osmnx'

**Cause:** Python packages not installed in venv, or system Python used instead of venv Python.

**Root cause:** Dockerfile was purging `build-essential` during package installation, breaking native extension compilation.

**Fix applied:** 
```dockerfile
# Install in venv first, THEN optionally clean up tools
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir -r py_engine/requirements.txt
# Note: Don't purge build-essential here - needed for compilation

# Use explicit venv path for verification
RUN /opt/venv/bin/python3 -c "import osmnx, ezdxf, geopandas; print('OK')"
```

### Container Fails Health Check

Check what the health endpoint returns:

```bash
docker compose exec app curl localhost:8080/health
```

### Port Already in Use

```bash
# Find what's using port 8080
lsof -i :8080

# Use a different port
docker run -p 9090:8080 sisrua-app
```

### Out of Memory During Build

The Python packages (osmnx, geopandas) require significant memory to compile.

**Fix:** Increase Docker Desktop memory limit to at least 4GB.

## Security Features

- ✅ Non-root user (`appuser`, UID 10000)
- ✅ Multi-stage build (no build tools in production image)
- ✅ Minimal base image (Ubuntu 24.04)
- ✅ No package manager cache in final image
- ✅ Health check endpoint
- ✅ `.dockerignore` excludes sensitive files

## Migration from Redis/Bull

The application was migrated from Redis + Bull queue to Google Cloud Tasks:

| Removed | Added |
|---------|-------|
| `bull` package | `@google-cloud/tasks` |
| `ioredis` package | `uuid` package |
| Redis infrastructure | Cloud Tasks (managed by Google) |

**Benefits:**
- No Redis container needed
- No idle infrastructure cost
- Google manages reliability and scaling
- Built-in OIDC authentication

The `docker-compose.yml` includes an optional Redis profile for development experiments, but Cloud Tasks is the production standard.
