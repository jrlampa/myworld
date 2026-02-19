# Cloud Tasks

This document covers Cloud Tasks setup, configuration, and troubleshooting for the SIS RUA application.

## Architecture

SIS RUA uses Google Cloud Tasks for asynchronous DXF generation:

```
User Request → POST /api/dxf
                    ↓
            Create Cloud Task
                    ↓
         Cloud Tasks Queue (sisrua-queue)
                    ↓
         HTTP POST (with OIDC) to webhook
                    ↓
         POST /api/tasks/process-dxf
                    ↓
         Python Engine → DXF file
                    ↓
         Job status updated → User polls /api/jobs/:id
```

**Why Cloud Tasks instead of Redis/Bull?**
- Serverless-native: integrates with Cloud Run without external infrastructure
- Managed service: Google handles scaling, reliability, durability
- Cost-effective: pay only for tasks executed
- Built-in OIDC authentication for secure webhook callbacks

## Environment Variables

```bash
GCP_PROJECT=sisrua-producao
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=sisrua-queue
CLOUD_RUN_BASE_URL=https://sisrua-app-xxxxx.southamerica-east1.run.app
```

## Queue Setup

### Automatic (Recommended)

The queue is automatically created during deployment via GitHub Actions if it doesn't exist.

### Manual Setup

```bash
gcloud tasks queues create sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=10
```

### Verify Queue Exists

```bash
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

## Service Account Permissions

The Cloud Run service account needs:

| Role | Purpose |
|------|---------|
| `roles/cloudtasks.enqueuer` | Create tasks in the queue |
| `roles/run.invoker` | Allow Cloud Tasks to call the webhook via OIDC |

### Grant Permissions

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant Cloud Tasks enqueuer
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudtasks.enqueuer"

# Grant Cloud Run invoker (for webhook OIDC)
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

### Verify Permissions

```bash
# Check Cloud Tasks enqueuer
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter='bindings.role=roles/cloudtasks.enqueuer' \
  --format="table(bindings.role,bindings.members)"

# Check Cloud Run invoker
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

## OIDC Authentication (Webhook Security)

The webhook endpoint `/api/tasks/process-dxf` validates OIDC tokens from Cloud Tasks.

### Middleware Implementation

```typescript
import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client();

async function verifyCloudTasksToken(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return false;
  
  const token = authHeader.substring(7);
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.CLOUD_RUN_SERVICE_URL
    });
    const payload = ticket.getPayload();
    return payload?.email === process.env.GCP_SERVICE_ACCOUNT;
  } catch (error) {
    return false;
  }
}
```

The middleware is automatically skipped in development mode.

## Testing

### Method 1: Via API Endpoint

```bash
# Start the server in development mode
npm run dev

# Make a DXF generation request
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -22.809100,
    "lon": -43.360432,
    "radius": 2000,
    "mode": "circle",
    "projection": "utm"
  }'

# Response: {"status":"queued","jobId":"abc-123"}

# Poll for completion
curl http://localhost:3001/api/jobs/abc-123
```

### Method 2: Direct Webhook Test (Development)

```bash
curl -X POST http://localhost:3001/api/tasks/process-dxf \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-123",
    "lat": -22.809100,
    "lon": -43.360432,
    "radius": 2000,
    "mode": "circle"
  }'
```

## Troubleshooting

### "5 NOT_FOUND: Requested entity was not found"

**Cause**: The service account lacks `roles/cloudtasks.enqueuer`. Google returns `NOT_FOUND` instead of `PERMISSION_DENIED` for security (to avoid revealing resource existence).

**Fix**: Grant the required IAM role (see Service Account Permissions above).

### "Permission Denied" When Creating Tasks

**Cause**: Service account missing `cloudtasks.tasks.create` permission.

**Fix**: Grant `roles/cloudtasks.enqueuer` to the Cloud Run service account.

### "OIDC Authentication Failed" for Webhook

**Cause**: Cloud Tasks can't authenticate to call the webhook.

**Fix**: Grant `roles/run.invoker` to the service account. Also verify `GCP_SERVICE_ACCOUNT` environment variable is set correctly in Cloud Run.

### Cloud Tasks Queue Already Exists (on create)

This is not an error — the deployment workflow handles this with an existence check before creating.

### Development Mode vs Production Mode

In development mode (`NODE_ENV !== 'production'`), DXF generation runs directly without Cloud Tasks (synchronous). This allows testing without the full GCP infrastructure.

In production mode, all DXF requests are queued via Cloud Tasks and processed asynchronously.

## Job Status Tracking

Jobs are tracked via the `/api/jobs/:id` endpoint:

```bash
curl http://localhost:3001/api/jobs/your-job-id
```

Response:
```json
{
  "id": "your-job-id",
  "status": "queued|processing|completed|failed",
  "progress": 0-100,
  "result": {
    "url": "/downloads/filename.dxf",
    "filename": "filename.dxf"
  },
  "error": null
}
```

> **Note**: Job status is currently stored in-memory and is lost on Cloud Run instance restart. See [Firestore documentation](firestore.md) for persistent storage.
