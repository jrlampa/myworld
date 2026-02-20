# Auto-Healing Deployment System

The auto-healing deployment system automatically detects, analyzes, and fixes deployment failures for the sisRUA application.

## Overview

When a deployment fails, the system:
1. Detects the failure automatically
2. Analyzes logs and categorizes the error
3. Applies an automated fix (if available)
4. Retries the deployment
5. Notifies if manual intervention is required

## Architecture

```
Pre-Deploy → Deploy to Cloud Run → SUCCESS ✅
                    ↓
                 FAILURE ❌
                    ↓
         Auto-Heal Triggered
                    ↓
         Detect & Analyze Error
                    ↓
         Apply Automated Fix
                    ↓
              Retry Deploy
                    ↓
         SUCCESS ✅ or MANUAL INTERVENTION ⚠️
```

## Workflows

### Main: `auto-heal-deploy.yml`

Triggered automatically when "Deploy to Cloud Run" fails, or manually via `workflow_dispatch`.

**Jobs:**
1. `detect-failure` — Analyzes logs, categorizes errors
2. `analyze-and-fix` — Downloads logs, applies fixes, generates report
3. `retry-deployment` — Waits (30s backoff), triggers new deployment
4. `notify-failure` — Alerts when manual intervention is required
5. `success-notification` — Confirms successful auto-healing

### Helper: `.github/scripts/analyze-deployment-error.js`

Parses deployment logs, matches error patterns, and outputs JSON for workflow consumption.

## Supported Error Types

| Error Type | Detection Pattern | Automated Fix |
|------------|-------------------|---------------|
| Permissions | `Permission denied`, `PERMISSION_DENIED` | Grant IAM roles |
| API Disabled | `API not enabled`, `Service not enabled` | Enable APIs |
| Missing Resource | `does not exist`, `NOT_FOUND` | Create Cloud Tasks queue |
| Build Error | Docker/image issues | Clean rebuild |
| Timeout | Deployment timeouts | Retry with extended timeout |
| Quota | Resource quota exceeded | ⚠️ Manual |
| Configuration | Invalid settings | ⚠️ Manual |
| Dependency | npm/package issues | ⚠️ Manual |
| TypeScript | Compilation failures | ⚠️ Manual |

## Automated Fixes

### Permissions Fix

```bash
# Grant Cloud Tasks enqueuer role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/cloudtasks.enqueuer"

# Grant Cloud Run invoker role
gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/run.invoker"
```

### API Fix

```bash
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  cloudtasks.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### Resource Fix

```bash
# Create Cloud Tasks queue if missing
gcloud tasks queues create sisrua-queue \
  --location=southamerica-east1 \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=10
```

## Usage

### Automatic Trigger

The auto-healing workflow activates automatically when a deployment fails. No action required.

### Manual Trigger

```bash
# Via GitHub CLI
gh workflow run auto-heal-deploy.yml --ref main -f max_retries=3
```

Or via GitHub UI: Actions → "Auto-Heal Deployment" → "Run workflow"

### Configuration

Default retry limit: **3 attempts** with 30-second backoff between retries.

## Required Permissions

The auto-healing workflow requires:

```yaml
permissions:
  contents: write
  id-token: write
  actions: write
```

And the service account needs:
- `roles/cloudtasks.enqueuer`
- `roles/run.admin`
- `roles/iam.serviceAccountAdmin`

## Monitoring

### Check Healing Status

```bash
# List recent auto-healing runs
gh run list --workflow=auto-heal-deploy.yml --limit=5

# View specific run
gh run view <run-id> --log

# Download reports
gh run download <run-id>
```

### Log Locations

- Deployment Logs: `/tmp/logs/deploy-failure.log`
- Error Analysis: `/tmp/error-analysis.json`
- Healing Report: `/tmp/healing-report.md`

Artifacts are retained for 7–30 days in GitHub Actions.

## Troubleshooting

### Auto-Healing Not Triggering

Verify workflow permissions are set correctly and the workflow is enabled in repository settings.

### Fixes Not Being Applied

Check that the service account has the necessary roles and GCP APIs are accessible from the runner.

### Maximum Retries Reached

1. Review failure logs in GitHub Actions
2. Check healing reports in artifacts
3. Apply manual fixes
4. Update auto-healing patterns if it's a new error type

## Extending the System

### Adding New Error Patterns

Edit `.github/scripts/analyze-deployment-error.js`:

```javascript
{
  pattern: /your-error-pattern/i,
  type: 'your-error-type',
  severity: 'high',
  fixes: ['Fix step 1', 'Fix step 2'],
  automated: true
}
```

### Adding New Automated Fixes

Edit `.github/workflows/auto-heal-deploy.yml` in the `Apply Automated Fixes` step:

```yaml
your-error-type)
  echo "Fixing your error type..."
  # Add fix commands here
  FIX_APPLIED="true"
  ;;
```

## Security Considerations

- Uses Workload Identity Federation (no stored credentials)
- Scoped service account permissions
- No secrets exposed in logs or artifacts
- Complete audit trail via GitHub Actions
- Requires elevated permissions: `actions: write`, `contents: write`
