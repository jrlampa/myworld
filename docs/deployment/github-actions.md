# GitHub Actions CI/CD Workflows

The project uses GitHub Actions for automated testing, building, and deployment to Google Cloud Run.

## Workflows Overview

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| Pre-Deploy Checks | `pre-deploy.yml` | Push/PR | Validate before deploy |
| Deploy to Cloud Run | `deploy-cloud-run.yml` | Push to main/production | Deploy the app |
| Post-Deploy Check | `post-deploy-check.yml` | After deploy | Verify deployment |
| Health Check | `health-check.yml` | Scheduled + after deploy | Monitor service health |
| Auto-Heal Deploy | `auto-heal-deploy.yml` | On deploy failure | Self-healing |
| Version Check | `version-check.yml` | Push | Validate version consistency |

## Pre-Deploy Checks (`pre-deploy.yml`)

Validates everything before deployment:

- ✅ Required files present
- ✅ Required secrets configured
- ✅ Dependencies installed
- ✅ TypeScript compilation
- ✅ Frontend build
- ✅ Docker build syntax

## Deploy to Cloud Run (`deploy-cloud-run.yml`)

Main deployment workflow:

1. Authenticate via Workload Identity Federation (no stored credentials)
2. Enable required Google Cloud APIs
3. Build and push Docker image
4. Deploy to Cloud Run (southamerica-east1)
5. Ensure Cloud Tasks queue exists
6. Capture and update service URL

**Cloud Run Configuration:**
```yaml
memory: 1024Mi
cpu: 2
timeout: 300s
min-instances: 0
max-instances: 10
allow-unauthenticated: true
```

## Post-Deploy Check (`post-deploy-check.yml`)

Runs automatically after deployment completes:

- Verifies Cloud Run service is ready
- Tests service URL is accessible
- Validates required environment variables are set:
  - `NODE_ENV`
  - `GCP_PROJECT`
  - `CLOUD_TASKS_LOCATION`
  - `CLOUD_TASKS_QUEUE`
  - `GROQ_API_KEY`
  - `CLOUD_RUN_BASE_URL`

## Health Check (`health-check.yml`)

Runs scheduled (every 6 hours) and after each deployment.

**Endpoints Tested:**
1. `GET /health` — Service status
2. `GET /` — Frontend (index.html)
3. `POST /api/search` — Geocoding
4. `POST /api/analyze` — AI Analysis (Groq)
5. `POST /api/elevation/profile` — Elevation profiles
6. `POST /api/dxf` — DXF generation
7. `GET /api/jobs/:id` — Job status (Cloud Tasks)
8. `GET /theme-override.css` — Static assets
9. `GET /api-docs/` — Swagger documentation

## Triggering Deployments

### Automatic

Push to `main` or `production` branch.

### Manual

```bash
# Via GitHub CLI
gh workflow run deploy-cloud-run.yml --ref main

# Via GitHub UI
# Actions → "Deploy to Cloud Run" → "Run workflow"
```

### Empty Commit (Redeploy)

```bash
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

## Security

- **Workload Identity Federation**: No static GCP credentials stored in GitHub
- **Minimal Permissions**: `contents: read`, `id-token: write`
- **Secrets Masked**: All secrets are masked in workflow logs
- **Concurrency Control**: Prevents duplicate deployments

## Required GitHub Secrets

Configure at: `https://github.com/jrlampa/myworld/settings/secrets/actions`

| Secret | Required | Description |
|--------|----------|-------------|
| `GCP_WIF_PROVIDER` | ✅ | Workload Identity Provider resource name |
| `GCP_SERVICE_ACCOUNT` | ✅ | Service account email for deployment |
| `GCP_PROJECT_ID` | ✅ | GCP project ID |
| `GCP_PROJECT` | ✅ | GCP project name |
| `GROQ_API_KEY` | ✅ | GROQ AI API key |
| `CLOUD_RUN_BASE_URL` | Optional | Auto-captured after first deploy |

## Version Check (`version-check.yml`)

Validates that version numbers are consistent across:
- `VERSION` file (source of truth)
- `package.json`
- `py_engine/constants.py`
- `src/hooks/useFileOperations.ts`

Run locally:
```bash
npm run version:check
```
