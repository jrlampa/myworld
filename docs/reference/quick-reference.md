# Quick Reference

Essential commands and information for SIS RUA deployment and operations.

## Service Information

- **Application**: SIS RUA Unified
- **GCP Project**: `sisrua-producao`
- **Project Number**: `244319582382`
- **Service Account**: `244319582382-compute@developer.gserviceaccount.com`
- **Region**: `southamerica-east1`
- **Cloud Run Service**: `sisrua-app`
- **Cloud Tasks Queue**: `sisrua-queue`
- **Repository**: `https://github.com/jrlampa/myworld`

## Essential Commands

### Deploy

```bash
# Manual deploy
cd sisrua_unified
gcloud run deploy sisrua-app \
  --source=. \
  --region=southamerica-east1 \
  --project=sisrua-producao

# Trigger via git push
git push origin main

# Manual trigger via GitHub CLI
gh workflow run deploy-cloud-run.yml --ref main
```

### Get Service URL

```bash
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)
echo $SERVICE_URL
```

### Health Check

```bash
curl ${SERVICE_URL}/health | jq
```

### View Logs

```bash
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=50
```

## IAM Setup (One-Time)

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Cloud Tasks enqueuer
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${SA}" \
  --role="roles/cloudtasks.enqueuer"

# Cloud Run invoker (after service exists)
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${SA}" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

## Environment Variables

### Required in Production

```bash
NODE_ENV=production
GCP_PROJECT=sisrua-producao
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=sisrua-queue
CLOUD_RUN_BASE_URL=https://sisrua-app-xxx.southamerica-east1.run.app
GROQ_API_KEY=gsk_...
PORT=8080
```

### Update Service Variables

```bash
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --update-env-vars="KEY=value" \
  --project=sisrua-producao
```

## Quick DXF Test

```bash
# Generate DXF (São Paulo area)
curl -X POST ${SERVICE_URL}/api/dxf \
  -H "Content-Type: application/json" \
  -d '{"lat": -23.566390, "lon": -46.656081, "radius": 500, "mode": "circle", "projection": "local"}'

# Check job status
curl ${SERVICE_URL}/api/jobs/<jobId>
```

## Quick GROQ Test

```bash
curl -X POST ${SERVICE_URL}/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"stats": {"buildings": 10}, "locationName": "Test"}'
```

## Cloud Tasks Queue

```bash
# Check queue status
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao

# Create queue (if missing)
gcloud tasks queues create sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=10
```

## GitHub Secrets

Configure at: `https://github.com/jrlampa/myworld/settings/secrets/actions`

| Secret | Value Format |
|--------|-------------|
| `GCP_WIF_PROVIDER` | `projects/244319582382/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `244319582382-compute@developer.gserviceaccount.com` |
| `GCP_PROJECT_ID` | `sisrua-producao` |
| `GCP_PROJECT` | `sisrua-producao` |
| `GROQ_API_KEY` | `gsk_...` |
| `CLOUD_RUN_BASE_URL` | `https://sisrua-app-xxx.southamerica-east1.run.app` |

## Rollback

```bash
# List revisions
gcloud run revisions list \
  --service=sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao

# Roll back to specific revision
gcloud run services update-traffic sisrua-app \
  --region=southamerica-east1 \
  --to-revisions=<revision>=100 \
  --project=sisrua-producao
```

## Local Development

```bash
# Using Docker (recommended)
cd sisrua_unified
docker compose up

# Native development
npm install
pip3 install -r py_engine/requirements.txt
npm run server  # Terminal 1
npm run client  # Terminal 2

# Access: http://localhost:3000
```

## Useful API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health |
| `/api/search` | POST | Geocoding |
| `/api/dxf` | POST | Start DXF generation |
| `/api/jobs/:id` | GET | Job status |
| `/api/analyze` | POST | AI analysis |
| `/api/elevation/profile` | POST | Elevation data |
| `/api/firestore/status` | GET | Firestore quota status |
| `/api-docs/` | GET | Swagger documentation |
