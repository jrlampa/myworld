# Auto-Healing Deployment - Quick Reference

## Overview
The auto-healing system automatically detects and fixes deployment failures in the sisRUA application.

## Key Components

### 1. Workflow: `.github/workflows/auto-heal-deploy.yml`
- Triggered automatically on deployment failure
- Can be manually triggered via GitHub Actions UI
- Configurable retry limit (default: 3)

### 2. Analysis Script: `.github/scripts/analyze-deployment-error.js`
- Analyzes deployment logs
- Detects 10 different error types
- Suggests automated and manual fixes

### 3. Documentation: `AUTO_HEALING_DEPLOYMENT.md`
- Complete system documentation
- Architecture diagrams
- Troubleshooting guide

## Supported Error Types

| Error Type | Auto-Fix | Common Cause |
|------------|----------|--------------|
| **permissions** | ✅ Yes | Missing IAM roles |
| **api** | ✅ Yes | Disabled Google Cloud APIs |
| **build** | ✅ Yes | Docker build failures |
| **resource** | ✅ Yes | Missing Cloud Tasks queue |
| **timeout** | ✅ Yes | Deployment timeout |
| **quota** | ❌ No | Resource quota exceeded |
| **configuration** | ❌ No | Invalid config values |
| **dependencies** | ❌ No | npm/package issues |
| **typescript** | ❌ No | Compilation errors |
| **docker** | ❌ No | Dockerfile syntax errors |

## Quick Actions

### Manual Trigger
```bash
# Via GitHub CLI
gh workflow run auto-heal-deploy.yml --ref main -f max_retries=3
```

### Check Status
```bash
# List recent auto-heal runs
gh run list --workflow=auto-heal-deploy.yml --limit=5

# View specific run
gh run view <run-id>
```

### Download Reports
```bash
# Download healing report
gh run download <run-id> --name healing-report

# Download failure logs
gh run download <run-id> --name deployment-failure-logs
```

## Automated Fixes

### Permissions Fix
```bash
# What the system does automatically:
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA" \
  --role="roles/cloudtasks.enqueuer"

gcloud run services add-iam-policy-binding $SERVICE \
  --member="serviceAccount:$SA" \
  --role="roles/run.invoker"
```

### API Fix
```bash
# What the system does automatically:
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  cloudtasks.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### Resource Fix
```bash
# What the system does automatically:
gcloud tasks queues create sisrua-queue \
  --location=southamerica-east1 \
  --max-dispatches-per-second=10
```

## Common Scenarios

### Scenario 1: First-Time Deployment Fails
**Likely Cause**: Missing resources or APIs not enabled  
**Auto-Fix**: ✅ Yes  
**Action**: None required - system will heal automatically

### Scenario 2: Permission Denied Error
**Likely Cause**: IAM roles not configured  
**Auto-Fix**: ✅ Yes  
**Action**: None required - system will grant permissions

### Scenario 3: Build Timeout
**Likely Cause**: Slow network or large dependencies  
**Auto-Fix**: ✅ Yes (retry)  
**Action**: None required - system will retry

### Scenario 4: Compilation Error
**Likely Cause**: TypeScript or code syntax issues  
**Auto-Fix**: ❌ No  
**Action**: Fix code errors manually

## Monitoring

### Key Metrics
- **Healing Success Rate**: Track in workflow runs
- **Common Error Types**: Review failure logs
- **Retry Attempts**: Monitor retry count

### Alerts
Watch for:
- Maximum retries reached (manual intervention needed)
- Repeated failures of same type (may need new pattern)
- Unknown error types (may need pattern update)

## Integration

### Pre-Deploy → Deploy → Auto-Heal Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Pre-Deploy │ --> │   Deploy    │ --> │  Success ✅ │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼ Failure
                    ┌─────────────┐
                    │ Auto-Heal 🤖│
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
            ┌─────────────┐  ┌─────────────┐
            │  Fixed ✅   │  │  Manual ⚠️  │
            └──────┬──────┘  └─────────────┘
                   │
                   ▼
            ┌─────────────┐
            │    Retry    │
            └─────────────┘
```

## Troubleshooting

### Auto-Heal Not Triggering
1. Check workflow permissions in repository settings
2. Verify workflow is enabled
3. Review GitHub Actions logs

### Fixes Not Being Applied
1. Check service account permissions
2. Verify GCP project access
3. Review detailed logs in workflow run

### Maximum Retries Reached
1. Download failure logs: `gh run download <run-id>`
2. Review error type and details
3. Apply manual fix based on logs
4. Re-run deployment manually

## Configuration

### Adjust Retry Limit
Edit `.github/workflows/auto-heal-deploy.yml`:
```yaml
env:
  MAX_RETRIES: 5  # Change from default 3
```

### Add New Error Pattern
Edit `.github/scripts/analyze-deployment-error.js`:
```javascript
{
  pattern: /your-error-pattern/i,
  type: 'your-type',
  severity: 'high',
  fixes: ['Fix description'],
  automated: true
}
```

### Add New Automated Fix
Edit `.github/workflows/auto-heal-deploy.yml`:
```yaml
your-type)
  echo "Fixing your error..."
  # Add fix commands
  FIX_APPLIED="true"
  ;;
```

## Best Practices

1. **Monitor regularly**: Review auto-heal runs weekly
2. **Update patterns**: Add new error patterns as discovered
3. **Set appropriate limits**: Adjust retry count for environment
4. **Review reports**: Check healing reports to identify trends
5. **Keep documentation updated**: Update docs when adding patterns

## Support Resources

- **Full Documentation**: [AUTO_HEALING_DEPLOYMENT.md](../AUTO_HEALING_DEPLOYMENT.md)
- **Integration Tests**: Run `.github/scripts/test-auto-healing.sh`
- **Workflow Logs**: GitHub Actions → Auto-Heal Deployment
- **Error Analysis**: Download artifacts from failed runs

## Security Notes

- ✅ Uses Workload Identity Federation (no stored keys)
- ✅ Scoped service account permissions
- ✅ No secrets exposed in logs
- ✅ Audit trail via GitHub Actions logs
- ⚠️ Requires write permissions (actions, contents)

## Version History

- **v1.0.0** (Feb 2026): Initial release
  - 10 error patterns
  - 5 automated fix types
  - Comprehensive documentation
  - Integration tests

---

**Quick Links**:
- [Full Documentation](../AUTO_HEALING_DEPLOYMENT.md)
- [Main README](../README.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)
