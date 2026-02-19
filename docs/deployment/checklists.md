# Deployment Checklists

## Pre-Deployment Checklist

### GitHub Secrets Verification

Verify all required secrets exist at: `https://github.com/jrlampa/myworld/settings/secrets/actions`

- [ ] `GCP_WIF_PROVIDER` — Workload Identity Provider
- [ ] `GCP_SERVICE_ACCOUNT` — Service account email
- [ ] `GCP_PROJECT_ID` — GCP project ID (`sisrua-producao`)
- [ ] `GCP_PROJECT` — GCP project name (`sisrua-producao`)
- [ ] `GROQ_API_KEY` — GROQ API key (starts with `gsk_`)
- [ ] `CLOUD_RUN_BASE_URL` — Cloud Run URL (can be empty for first deploy)

### Code Quality

- [ ] All backend tests passing (`npm run test:backend`)
- [ ] All frontend tests passing (`npm run test`)
- [ ] TypeScript compiles without errors (`npm run build:server`)
- [ ] Frontend builds successfully (`npm run build`)
- [ ] Security scan clean (CodeQL: 0 vulnerabilities)
- [ ] No API keys or secrets committed to code

### Docker Build

- [ ] Dockerfile syntax valid
- [ ] Python dependencies installed correctly in venv
- [ ] Python dependencies importable (`import osmnx, ezdxf, geopandas`)
- [ ] Build verification step passes

## During Deployment

- [ ] Monitor GitHub Actions workflow
- [ ] Watch for error messages in logs
- [ ] Confirm "Deploy to Cloud Run" step completes
- [ ] Verify service URL is captured automatically

## Post-Deployment Checklist

### Basic Verification

```bash
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

# Health check
curl ${SERVICE_URL}/health
```

Expected response:
```json
{
  "status": "online",
  "service": "sisRUA Unified Backend",
  "version": "1.0.0",
  "python": "available",
  "environment": "production"
}
```

### Endpoint Tests

- [ ] Health check responds: `GET /health`
- [ ] Frontend loads: `GET /` returns HTML
- [ ] Geocoding works: `POST /api/search`
- [ ] DXF generation initiates: `POST /api/dxf`
- [ ] Job status works: `GET /api/jobs/:id`
- [ ] AI analysis works: `POST /api/analyze` (requires GROQ_API_KEY)
- [ ] Elevation profiles load: `POST /api/elevation/profile`

### IAM Permissions (Required After New Deploy)

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")

# Verify Cloud Tasks enqueuer
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/cloudtasks.enqueuer AND bindings.members:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# If missing, grant it:
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

# Verify Cloud Run invoker
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao

# If service account not listed, grant it:
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

### Environment Variables Verification

```bash
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='get(spec.template.spec.containers[0].env)' \
  --project=sisrua-producao
```

Required variables:
- [ ] `NODE_ENV=production`
- [ ] `GCP_PROJECT=sisrua-producao`
- [ ] `CLOUD_TASKS_LOCATION=southamerica-east1`
- [ ] `CLOUD_TASKS_QUEUE=sisrua-queue`
- [ ] `GROQ_API_KEY` is set
- [ ] `CLOUD_RUN_BASE_URL` matches the service URL

### DXF Generation Test

```bash
curl -X POST ${SERVICE_URL}/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -22.15018,
    "lon": -42.92189,
    "radius": 500,
    "mode": "circle",
    "projection": "local"
  }'
```

Expected response:
```json
{"status": "queued", "jobId": "some-uuid"}
```

Then poll for completion:
```bash
curl ${SERVICE_URL}/api/jobs/<jobId>
```

## Implementation Checklist

When implementing new features or fixing bugs before deployment:

- [ ] Write/update unit tests
- [ ] Run full test suite
- [ ] Check for memory leaks (intervals cleaned up)
- [ ] Verify environment variable handling
- [ ] Check for hardcoded URLs or credentials
- [ ] Review CORS configuration
- [ ] Test rate limiting behavior
- [ ] Validate input schemas with Zod
- [ ] Review error messages (no stack traces to users)
- [ ] Update CHANGELOG.md

## Rollback Procedure

If deployment fails and auto-healing doesn't resolve it:

```bash
# List previous revisions
gcloud run revisions list \
  --service=sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao

# Roll back to a specific revision
gcloud run services update-traffic sisrua-app \
  --region=southamerica-east1 \
  --to-revisions=<revision-name>=100 \
  --project=sisrua-producao
```
