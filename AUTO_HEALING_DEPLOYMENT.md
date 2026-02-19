# Auto-Healing Deployment System

## Overview

The Auto-Healing Deployment System is an intelligent workflow that automatically detects, analyzes, and fixes deployment failures in the sisRUA application. It implements a self-healing pattern that reduces manual intervention and improves deployment reliability.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Deployment Flow                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Pre-Deploy     │
                    │   Validation     │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Deploy to       │
                    │  Cloud Run       │
                    └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │                  │
                    ▼                  ▼
            ┌──────────────┐   ┌──────────────┐
            │   SUCCESS    │   │   FAILURE    │
            └──────┬───────┘   └──────┬───────┘
                   │                  │
                   │                  ▼
                   │         ┌─────────────────┐
                   │         │  Auto-Heal      │
                   │         │  Triggered      │
                   │         └────────┬────────┘
                   │                  │
                   │                  ▼
                   │         ┌─────────────────┐
                   │         │ Detect & Analyze│
                   │         │ Error           │
                   │         └────────┬────────┘
                   │                  │
                   │                  ▼
                   │         ┌─────────────────┐
                   │         │ Apply Automated │
                   │         │ Fix             │
                   │         └────────┬────────┘
                   │                  │
                   │                  ▼
                   │         ┌─────────────────┐
                   │         │ Retry Deploy    │
                   │         └────────┬────────┘
                   │                  │
                   │                  └────────┐
                   │                           │
                   ▼                           ▼
            ┌──────────────┐          ┌──────────────┐
            │ Post-Deploy  │          │   Manual     │
            │ Verification │          │ Intervention │
            └──────────────┘          └──────────────┘
```

## Features

### 1. Automatic Error Detection

The system monitors the "Deploy to Cloud Run" workflow and automatically detects failures. It categorizes errors into:

- **Permissions Errors**: IAM and service account issues
- **API Errors**: Disabled or missing Google Cloud APIs
- **Build Errors**: Docker build and image issues
- **Resource Errors**: Missing Cloud Tasks queues or other resources
- **Timeout Errors**: Deployment timeouts
- **Quota Errors**: Resource quota exceeded
- **Configuration Errors**: Invalid deployment configurations
- **Dependency Errors**: npm/package issues
- **TypeScript Errors**: Compilation failures
- **Docker Errors**: Dockerfile and container issues

### 2. Intelligent Analysis

The system uses pattern matching and log analysis to:

- Identify the root cause of failures
- Determine if automated fixes are available
- Prioritize fixes based on severity
- Generate detailed error reports

### 3. Automated Fixes

The following issues can be automatically fixed:

#### Permissions Errors
- Grants `roles/cloudtasks.enqueuer` to service accounts
- Grants `roles/run.invoker` to service accounts
- Configures Workload Identity Federation

#### API Errors
- Enables required Google Cloud APIs:
  - Cloud Run API
  - Cloud Build API
  - Artifact Registry API
  - Cloud Tasks API
  - Cloud Resource Manager API

#### Resource Errors
- Creates missing Cloud Tasks queues
- Configures queue parameters (dispatch rate, concurrency)

#### Build Errors
- Triggers clean rebuild
- Clears build cache (handled by Cloud Build)

#### Timeout Errors
- Retries with extended timeout
- Optimizes deployment parameters

### 4. Retry Logic

- **Configurable Retry Limits**: Default 3 attempts, configurable via workflow input
- **Exponential Backoff**: 30-second delay between retries
- **Retry Tracking**: Monitors attempt count to prevent infinite loops

### 5. Comprehensive Logging

- **Failure Logs**: Captured and stored as artifacts
- **Healing Reports**: Detailed reports of actions taken
- **Success/Failure Notifications**: Clear status messages

## Workflows

### Main Workflow: `auto-heal-deploy.yml`

Triggered automatically when "Deploy to Cloud Run" fails, or manually via `workflow_dispatch`.

#### Jobs

1. **detect-failure**: 
   - Analyzes deployment logs
   - Determines error type
   - Decides if healing should proceed

2. **analyze-and-fix**:
   - Downloads failure logs
   - Applies automated fixes based on error type
   - Generates healing report

3. **retry-deployment**:
   - Checks retry count against limit
   - Waits before retry
   - Triggers new deployment

4. **notify-failure**:
   - Runs if healing fails
   - Provides details for manual intervention

5. **success-notification**:
   - Runs if healing succeeds
   - Confirms successful auto-healing

### Helper Script: `analyze-deployment-error.js`

Advanced error analysis script that:
- Parses deployment logs
- Matches error patterns
- Suggests fixes
- Outputs JSON for workflow consumption

## Usage

### Automatic Trigger

The auto-healing workflow runs automatically when a deployment fails. No manual intervention is required.

### Manual Trigger

You can manually trigger the auto-healing workflow:

1. Go to Actions tab in GitHub
2. Select "Auto-Heal Deployment" workflow
3. Click "Run workflow"
4. Optionally set max retries (default: 3)

### Configuration

#### Environment Variables

Set in `.github/workflows/auto-heal-deploy.yml`:

```yaml
env:
  MAX_RETRIES: 3  # Maximum healing attempts
```

#### Workflow Inputs

When manually triggering:

- `max_retries`: Maximum number of healing attempts (default: 3)

## Error Type Handling

### Permissions Errors

**Detection**: `Permission denied`, `PERMISSION_DENIED`

**Automated Fixes**:
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

### API Errors

**Detection**: `API not enabled`, `Service not enabled`

**Automated Fixes**:
```bash
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  cloudtasks.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### Resource Errors

**Detection**: `does not exist`, `NOT_FOUND`

**Automated Fixes**:
```bash
# Create Cloud Tasks queue
gcloud tasks queues create sisrua-queue \
  --location=southamerica-east1 \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=10
```

## Monitoring

### Check Healing Status

1. **GitHub Actions UI**:
   - Go to Actions tab
   - Look for "Auto-Heal Deployment" workflow runs
   - Check job status and logs

2. **Artifacts**:
   - Failure logs: Download from job artifacts
   - Healing reports: Available for 30 days

### Logs Location

- **Deployment Logs**: `/tmp/logs/deploy-failure.log`
- **Error Analysis**: `/tmp/error-analysis.json`
- **Healing Report**: `/tmp/healing-report.md`

## Best Practices

### 1. Monitor Healing Attempts

Regularly review auto-healing workflow runs to:
- Identify recurring issues
- Optimize automated fixes
- Update error patterns

### 2. Set Appropriate Retry Limits

- **Development**: Higher limits (5-10) for testing
- **Production**: Lower limits (2-3) to prevent resource waste

### 3. Review Healing Reports

Check healing reports to understand:
- What went wrong
- What fixes were applied
- Whether manual intervention is needed

### 4. Extend Error Patterns

Add new error patterns to `analyze-deployment-error.js` as you encounter new failure types.

## Troubleshooting

### Auto-Healing Not Triggering

**Possible Causes**:
- Workflow permissions not set correctly
- GitHub token lacks necessary scopes
- Workflow disabled in repository settings

**Solution**:
```yaml
permissions:
  contents: write
  id-token: write
  actions: write
```

### Fixes Not Being Applied

**Possible Causes**:
- Service account lacks required permissions
- GCP APIs not accessible
- Network connectivity issues

**Solution**:
- Verify service account has necessary roles
- Check GCP project configuration
- Review workflow logs for specific errors

### Maximum Retries Reached

**Possible Causes**:
- Issue requires manual intervention
- Error not covered by automated fixes
- Configuration error in application

**Solution**:
1. Review failure logs
2. Check healing reports
3. Apply manual fixes
4. Update auto-healing patterns if needed

## Security Considerations

### 1. Service Account Permissions

The auto-healing workflow requires specific permissions:

- `roles/cloudtasks.enqueuer`: To grant task enqueuer role
- `roles/run.admin`: To update Cloud Run services
- `roles/iam.serviceAccountAdmin`: To manage IAM bindings

### 2. GitHub Token Permissions

Required permissions:
- `contents: write`: To commit fixes if needed
- `id-token: write`: For Workload Identity Federation
- `actions: write`: To trigger deployment retry

### 3. Secrets Management

Ensure these secrets are configured:
- `GCP_WIF_PROVIDER`: Workload Identity Federation provider
- `GCP_SERVICE_ACCOUNT`: Service account email
- `GCP_PROJECT_ID`: Google Cloud project ID
- `GROQ_API_KEY`: API key for AI services

## Extending the System

### Adding New Error Patterns

Edit `.github/scripts/analyze-deployment-error.js`:

```javascript
{
  pattern: /your-error-pattern/i,
  type: 'your-error-type',
  severity: 'high|medium|low',
  fixes: [
    'Fix step 1',
    'Fix step 2'
  ],
  automated: true|false
}
```

### Adding New Automated Fixes

Edit `.github/workflows/auto-heal-deploy.yml`, in the `Apply Automated Fixes` step:

```yaml
your-error-type)
  echo "Fixing your error type..."
  # Add your fix commands here
  FIX_APPLIED="true"
  FIX_DESCRIPTION="Your fix description"
  ;;
```

## Performance Metrics

Track these metrics to measure effectiveness:

- **Healing Success Rate**: Successful heals / Total failures
- **Average Time to Heal**: Time from failure to successful retry
- **Manual Intervention Rate**: Failures requiring manual fixes
- **Common Error Types**: Most frequent failure categories

## Integration with Existing Workflows

The auto-healing system integrates seamlessly with:

- **Pre-Deploy Checks**: Validation runs before deployment
- **Deploy to Cloud Run**: Main deployment workflow
- **Post-Deploy Verification**: Verification after successful deployment
- **Health Check**: Continuous health monitoring

## Future Enhancements

Potential improvements:

1. **AI-Powered Analysis**: Use LLMs to analyze complex errors
2. **Predictive Healing**: Detect potential issues before failure
3. **Advanced Notifications**: Slack/email alerts for critical failures
4. **Metrics Dashboard**: Visual tracking of healing statistics
5. **Custom Fix Scripts**: User-defined healing procedures
6. **Multi-Region Support**: Handle region-specific failures
7. **Rollback Capability**: Automatic rollback on persistent failures

## Support

For issues or questions:

1. Check workflow logs in GitHub Actions
2. Review healing reports in artifacts
3. Consult this documentation
4. Open an issue in the repository

## License

This auto-healing system is part of the sisRUA project and follows the same license.

---

**Last Updated**: February 2026  
**Version**: 1.0.0  
**Maintainer**: See repository contributors
