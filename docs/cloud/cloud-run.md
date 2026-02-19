# Cloud Run

This document covers Cloud Run deployment fixes and CORS configuration for the SIS RUA application.

## CORS Fix (Critical)

### Problem

The frontend was failing to call the backend with error:
```
Error: Not allowed by CORS
Endpoint: /api/dxf
Origin: https://sisrua-app-244319582382.southamerica-east1.run.app
Status: HTTP 500
```

The Cloud Run service was rejecting requests from itself because its own URL wasn't in the CORS allowed list.

### Root Cause

```typescript
// BEFORE (broken): Only static localhost origins
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
];
if (process.env.CLOUD_RUN_BASE_URL) {
    allowedOrigins.push(process.env.CLOUD_RUN_BASE_URL);
}
// Cloud Run generates dynamic URLs not always matching CLOUD_RUN_BASE_URL
```

### Solution

```typescript
// AFTER (fixed): Detect Cloud Run origins dynamically
const isCloudRunOrigin = origin && (
    origin.includes('.run.app') ||
    origin.includes('southamerica-east1.run.app')
);

if (allowedOrigins.indexOf(origin) !== -1 || isCloudRunOrigin) {
    callback(null, true); // Allow
}
```

### Allowed Origins After Fix

1. `https://sisrua-app-244319582382.southamerica-east1.run.app` (production)
2. Any `https://*.run.app` (other Cloud Run services)
3. `http://localhost:3000` (Vite dev server)
4. `http://localhost:8080` (Express dev server)
5. Any URL configured in `CLOUD_RUN_BASE_URL`

### Security Note

Only Google Cloud Run domains (`.run.app`) are allowed dynamically. No arbitrary origins are permitted.

## IAM Permission Error Fix

### Problem

The deployment workflow was failing with:
```
ERROR: (gcloud.projects.add-iam-policy-binding) does not have permission 
to access projects instance [setIamPolicy] (or it may not exist)
```

### Root Cause

The deployment pipeline was attempting to grant IAM permissions during each deployment. This requires `setIamPolicy` permission which the deploy service account shouldn't have (security best practice).

### Solution

IAM permissions were removed from the deployment workflow. They should be configured once during initial setup using an account with Owner or IAM Admin permissions.

See [IAM documentation](iam.md) for setup commands.

## Cloud Tasks Queue Not Found (NOT_FOUND Error)

### Problem

```
Error: 5 NOT_FOUND: Requested entity was not found
```

Even though the queue existed, the app got this error.

### Root Cause

The Cloud Tasks queue `sisrua-queue` existed but the service account lacked permissions. Google Cloud returns `NOT_FOUND` (not `PERMISSION_DENIED`) for security — revealing "PERMISSION_DENIED" would confirm the resource exists (information disclosure).

### Fix

The deployment workflow now auto-creates the queue if it doesn't exist:

```yaml
- name: Ensure Cloud Tasks Queue Exists
  run: |
    if ! gcloud tasks queues describe sisrua-queue \
      --location=southamerica-east1 \
      --project=${{ secrets.GCP_PROJECT_ID }} &> /dev/null; then
      gcloud tasks queues create sisrua-queue \
        --location=southamerica-east1 \
        --project=${{ secrets.GCP_PROJECT_ID }} \
        --max-dispatches-per-second=10 \
        --max-concurrent-dispatches=10
    fi
```

And the service account must have `roles/cloudtasks.enqueuer`. See [Cloud Tasks documentation](cloud-tasks.md).

## Cloud Run Configuration

### Optimal Settings

```bash
gcloud run deploy sisrua-app \
  --memory=1024Mi \
  --cpu=2 \
  --timeout=300 \
  --min-instances=0 \
  --max-instances=10 \
  --region=southamerica-east1 \
  --allow-unauthenticated
```

### Health Check

The `/health` endpoint is used for Cloud Run health checks:

```json
{
  "status": "online",
  "service": "sisRUA Unified Backend",
  "version": "1.0.0",
  "python": "available",
  "environment": "production",
  "dockerized": true
}
```

### Viewing Logs

```bash
# View recent logs
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=50

# Filter CORS logs
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=sisrua-app" \
  --limit 50 --format json | jq '.[] | select(.jsonPayload.message | contains("CORS"))'
```

### Monitoring

Key metrics to monitor:
- Cloud Run instance count (auto-scaling)
- DXF generation request duration
- API error rates
- Memory usage (watch for OOM)
- File cleanup execution logs
