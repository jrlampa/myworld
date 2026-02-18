# SIS RUA Unified - Architecture & Task Processing

## Overview

This document describes the architecture and infrastructure decisions for SIS RUA Unified application.

## Task Processing Strategy

### Current Implementation: Google Cloud Tasks ✅

**No Redis/Bull Dependency**

This project uses **Google Cloud Tasks** exclusively for asynchronous job processing. The application does NOT depend on Redis, Bull, or any in-memory queue system.

#### Why Cloud Tasks?

1. **Serverless-Native**: Integrates seamlessly with Cloud Run without external infrastructure.
2. **Managed Service**: Google handles scaling, reliability, and durability.
3. **Cost-Effective**: Pay only for tasks executed, no idle infrastructure.
4. **Built-in Authentication**: Uses OIDC tokens for secure webhook callbacks.

#### Task Flow

1. **User Request** → Frontend/API makes DXF generation request
2. **Task Creation** → Backend creates Cloud Task via `cloudTasksService.ts`
3. **Queue Storage** → Google Cloud Tasks stores and manages the queue
4. **Webhook Execution** → Cloud Tasks triggers webhook at `/api/tasks/process-dxf`
5. **Python Engine** → Webhook handler spawns Python process for DXF generation
6. **Job Status** → Results stored in `jobStatusService.ts` (in-memory, Cloud Run stateless)

#### Key Files

- **[server/services/cloudTasksService.ts](server/services/cloudTasksService.ts)**: Task creation and management
- **[server/index.ts](server/index.ts)**: Webhook endpoint `/api/tasks/process-dxf`
- **[.github/workflows/deploy-cloud-run.yml](.github/workflows/deploy-cloud-run.yml)**: Deployment with Cloud Tasks configuration

#### Environment Variables (Required)

```bash
GCP_PROJECT              # GCP project ID (e.g., sisrua-producao)
CLOUD_TASKS_LOCATION    # Regional location (e.g., southamerica-east1)
CLOUD_TASKS_QUEUE       # Queue name (e.g., sisrua-queue)
CLOUD_RUN_BASE_URL      # Auto-captured after deployment (e.g., https://sisrua-app-xxxxx.run.app)
```

## Docker Optimization

### Multi-Stage Build Strategy

1. **frontend-build**: Vite/React bundling
2. **builder**: TypeScript compilation + Python venv setup
3. **production**: Final runtime with Node.js + Python venv (copied from builder)

### Python venv Reuse

The Python virtual environment (`/opt/venv`) is built once in the `builder` stage and copied to the production stage, avoiding duplicate `pip install` operations and reducing final image size.

**Benefit**: ~30-40% faster builds compared to installing packages twice.

## Deployment

### GitHub Actions Workflow

- **Pre-Deploy Checks**: `pre-deploy.yml` validates files, secrets, build compilation, and Docker image build
- **Main Deploy**: `deploy-cloud-run.yml` orchestrates Cloud Run deployment
- **Auto URL Capture**: Service URL is captured post-deployment and automatically set as `CLOUD_RUN_BASE_URL`

### Cloud Run Configuration

- **Memory**: 1024Mi (monitor for OOM on heavy workloads)
- **CPU**: 2 vCPU
- **Timeout**: 300 seconds (5 minutes per request)
- **Auto-scaling**: 0–10 instances
- **Authentication**: Workload Identity Federation (GitHub Actions)

## Known Limitations & Future Improvements

1. **Job Status Storage**: Currently in-memory (lost on restart). Consider Cloud Datastore or Firestore for persistence.
2. **Cache Storage**: In-memory Map-based (see `cacheService.ts`). Consider Cloud Storage for persistent cache.
3. **Memory Baseline**: No load testing yet. Monitor production logs for OOM events.

## Security Notes

- Non-root user execution (`appuser`, UID 10000)
- Service runs with minimal required permissions
- OIDC tokens used for Cloud Tasks → Cloud Run communication
- Secrets managed via GitHub Actions repository secrets
