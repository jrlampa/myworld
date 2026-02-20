# Deployment Guide

This document consolidates all deployment guides for the SIS RUA application to Google Cloud Run.

## Prerequisites

Before deploying, ensure you have:

1. Google Cloud SDK (`gcloud`) installed and configured
2. Access to the `sisrua-producao` GCP project
3. Docker installed (optional, for local builds)
4. Repository cloned locally

## GitHub Secrets Required

Configure these secrets at: **Settings → Secrets and variables → Actions**

| Secret | Description | Example |
|--------|-------------|---------|
| `GCP_WIF_PROVIDER` | Workload Identity Provider | `projects/244319582382/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | Service Account Email | `244319582382-compute@developer.gserviceaccount.com` |
| `GCP_PROJECT_ID` | GCP Project ID | `sisrua-producao` |
| `GCP_PROJECT` | GCP Project Name | `sisrua-producao` |
| `GROQ_API_KEY` | GROQ AI API Key | `gsk_...` |
| `CLOUD_RUN_BASE_URL` | Cloud Run URL (auto-captured after first deploy) | `https://sisrua-app-xxx.southamerica-east1.run.app` |

## Quick Start

### 1. Configure IAM Permissions (One-Time Setup)

```bash
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  cloudtasks.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project=sisrua-producao
```

### 3. Deploy the Application

**Option A: Via GitHub Actions (Recommended)**

Push to `main` or `production` branch, or trigger manually:
1. Go to Actions tab in GitHub
2. Select "Deploy to Cloud Run"
3. Click "Run workflow"

**Option B: Manual Deploy**

```bash
cd sisrua_unified
gcloud run deploy sisrua-app \
  --source=. \
  --region=southamerica-east1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1024Mi \
  --cpu=2 \
  --timeout=300 \
  --min-instances=0 \
  --max-instances=10 \
  --update-env-vars="GROQ_API_KEY=your-key,GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue,NODE_ENV=production" \
  --project=sisrua-producao
```

### 4. Post-Deployment: Update Service URL

```bash
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --update-env-vars="CLOUD_RUN_BASE_URL=${SERVICE_URL}" \
  --project=sisrua-producao
```

### 5. Re-run IAM Setup

After first deployment (service now exists):

```bash
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao
```

## Cloud Run Configuration

| Parameter | Value |
|-----------|-------|
| Memory | 1024Mi |
| CPU | 2 vCPU |
| Timeout | 300s (5 minutes) |
| Region | southamerica-east1 |
| Min Instances | 0 |
| Max Instances | 10 |

## Workload Identity Federation Setup

If Workload Identity Federation hasn't been configured yet:

```bash
# 1. Create Identity Pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool"

# 2. Create Provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='jrlampa/myworld'"

# 3. Get Provider ID (set as GCP_WIF_PROVIDER secret)
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)"

# 4. Allow GitHub Actions to use the Service Account
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
gcloud iam service-accounts add-iam-policy-binding \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/jrlampa/myworld"
```

## Deploying from Scratch (After Service Deletion)

If you deleted the Cloud Run service and need to start over:

1. **Verify GitHub secrets still exist** at `https://github.com/jrlampa/myworld/settings/secrets/actions`
2. **Trigger the deploy workflow** (push to main or manual trigger)
3. **Wait 5-10 minutes** for the deployment to complete
4. **Configure IAM permissions** (required after service recreation):

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")

# Grant Cloud Tasks enqueuer
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

# Grant Cloud Run invoker (for Cloud Tasks webhook)
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

## Runtime Environment Variables

```bash
NODE_ENV=production
GCP_PROJECT=sisrua-producao
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=sisrua-queue
CLOUD_RUN_BASE_URL=<auto-captured>
GROQ_API_KEY=<from-secrets>
PORT=8080
```

## Verification

After deployment, verify the service:

```bash
# Health check
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

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

## Troubleshooting

### Error: "Missing secret: CLOUD_RUN_BASE_URL"

This error was fixed — `CLOUD_RUN_BASE_URL` is now optional for the first deploy. If it still occurs:

```bash
gh secret set CLOUD_RUN_BASE_URL --body="pending" --repo jrlampa/myworld
```

### Error: "Service [sisrua-app] not found"

This is normal on the first deploy. The `gcloud run deploy` command creates the service automatically.

### Error: "Permission denied" / "Access denied"

Verify Workload Identity Federation is configured. Check:
```bash
gcloud iam workload-identity-pools describe github-pool --location=global
```

### Python Dependencies Not Found

The Docker multi-stage build should handle Python dependencies automatically. If the build fails, verify the Dockerfile uses the venv Python explicitly:
```dockerfile
RUN /opt/venv/bin/python3 -c "import osmnx, ezdxf, geopandas; print('OK')"
```

## Related Documentation

- [Auto-Healing Deployment](auto-healing.md)
- [Custom Domain Setup](custom-domain.md)
- [GitHub Actions CI/CD](github-actions.md)
- [Deployment Checklists](checklists.md)
- [IAM & Permissions](../cloud/iam.md)
- [Cloud Run Issues](../cloud/cloud-run.md)
