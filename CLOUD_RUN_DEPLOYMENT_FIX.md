# Fix Summary: Cloud Run Deployment IAM Permission Error

## Problem

The Cloud Run deployment was failing with the following error:

```
ERROR: (gcloud.projects.add-iam-policy-binding) [***] does not have permission to access projects instance [***:setIamPolicy] (or it may not exist): Policy update access denied.
Error: Process completed with exit code 1.
```

## Root Cause

The deployment workflow (`.github/workflows/deploy-cloud-run.yml`) was attempting to grant IAM permissions during deployment:

1. **Grant Cloud Tasks Permissions** (lines 71-82): Tried to grant `roles/cloudtasks.enqueuer` to the service account
2. **Grant Cloud Run Invoker Permission** (lines 117-129): Tried to grant `roles/run.invoker` to the service account

These steps failed because the GitHub Actions service account (`GCP_SERVICE_ACCOUNT`) does not have the `setIamPolicy` permission required to modify IAM policies at the project or service level.

## Solution Implemented

### 1. Removed IAM Permission Grants from Deployment Workflow

**Changed Files:**
- `.github/workflows/deploy-cloud-run.yml`

**Changes:**
- ✅ Removed "Grant Cloud Tasks Permissions" step
- ✅ Removed "Grant Cloud Run Invoker Permission" step

These steps were attempting operations that the deployment service account doesn't have permission to perform. IAM permissions should be configured once during initial setup, not on every deployment.

### 2. Created IAM Setup Documentation

**New Files:**
- `.github/IAM_SETUP_REQUIRED.md`

This comprehensive guide explains:
- ✅ Which IAM permissions are required
- ✅ Why they are needed
- ✅ How to grant them (with exact commands)
- ✅ How to verify they are configured correctly
- ✅ Troubleshooting common issues

### 3. Updated Deployment Documentation

**Changed Files:**
- `.github/DEPLOYMENT_SETUP.md`
- `.github/README.md`

**Changes:**
- ✅ Added prominent warning about IAM setup requirement
- ✅ Added links to IAM_SETUP_REQUIRED.md
- ✅ Explained that IAM setup is a prerequisite for deployment

## Required Manual Action

⚠️ **IMPORTANT**: Before the next deployment, you must configure the required IAM permissions manually. This is a **one-time setup**.

### Quick Setup (for project `sisrua-producao`)

Run these commands using an account with Owner or Project IAM Admin permissions:

```bash
# 1. Grant Cloud Tasks enqueuer role
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:sisrua-producao@appspot.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

# 2. Grant Cloud Run invoker role
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:sisrua-producao@appspot.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

### Full Documentation

For complete instructions, troubleshooting, and verification steps, see:
- **[.github/IAM_SETUP_REQUIRED.md](.github/IAM_SETUP_REQUIRED.md)**

## What These Permissions Do

### roles/cloudtasks.enqueuer
- **Purpose**: Allows the Cloud Run application to create tasks in the Cloud Tasks queue
- **Used For**: DXF file generation requests are queued as Cloud Tasks for asynchronous processing

### roles/run.invoker
- **Purpose**: Allows Cloud Tasks to invoke the Cloud Run webhook endpoint
- **Used For**: Cloud Tasks uses OIDC tokens to authenticate calls to `/api/tasks/process-dxf`

## Verification

After granting the permissions, verify they are correctly configured:

```bash
# Check Cloud Tasks enqueuer permission
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/cloudtasks.enqueuer AND bindings.members:serviceAccount:sisrua-producao@appspot.gserviceaccount.com"

# Check Cloud Run invoker permission
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/run.invoker"
```

Or use the verification script:
```bash
cd sisrua_unified
./scripts/verify-cloud-tasks-permissions.sh sisrua-producao
```

## Next Steps

1. ✅ **Grant the IAM permissions** using the commands above
2. ✅ **Wait 1-2 minutes** for IAM changes to propagate
3. ✅ **Trigger a new deployment** (push to main or run workflow manually)
4. ✅ **Monitor the deployment** in GitHub Actions
5. ✅ **Verify DXF generation works** after deployment

## Benefits of This Fix

1. ✅ **Simpler Deployment**: No longer requires elevated permissions for deployment
2. ✅ **Better Security**: Follows principle of least privilege
3. ✅ **Clearer Separation**: Setup vs. deployment steps are clearly separated
4. ✅ **Better Documentation**: Clear guide on what needs to be configured and why
5. ✅ **Idempotent Deployment**: Deployment can be run multiple times safely

## Files Changed

| File | Type | Changes |
|------|------|---------|
| `.github/workflows/deploy-cloud-run.yml` | Modified | Removed 2 IAM permission steps (-25 lines) |
| `.github/IAM_SETUP_REQUIRED.md` | New | Comprehensive IAM setup guide (+142 lines) |
| `.github/DEPLOYMENT_SETUP.md` | Modified | Added IAM setup prerequisite (+7 lines) |
| `.github/README.md` | Modified | Added IAM setup link (+2 lines) |

**Total**: 4 files, +126 lines (net)

## Technical Details

### Why "setIamPolicy" Permission Was Required

The `gcloud projects add-iam-policy-binding` and `gcloud run services add-iam-policy-binding` commands require the following permissions:

- `resourcemanager.projects.setIamPolicy` (for project-level bindings)
- `run.services.setIamPolicy` (for service-level bindings)

These are typically only granted to:
- Project Owners
- Project IAM Admins
- Security Admins

The GitHub Actions service account (used for deployment) typically has:
- `roles/run.admin` - Deploy and manage Cloud Run services
- `roles/iam.serviceAccountUser` - Act as service accounts

But **not** the permission to modify IAM policies, which is correct from a security perspective.

### Why Remove These Steps Instead of Granting More Permissions

We could have granted the GitHub Actions service account the `roles/resourcemanager.projectIamAdmin` role, but this would:
- ❌ Violate the principle of least privilege
- ❌ Give deployment pipelines too much power
- ❌ Create security risks
- ❌ Allow accidental or malicious permission changes

Instead, we:
- ✅ Keep deployment permissions minimal
- ✅ Configure IAM once during setup
- ✅ Document the setup process clearly
- ✅ Follow Google Cloud best practices

## References

- [Cloud Tasks IAM Roles](https://cloud.google.com/tasks/docs/access-control)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [IAM Best Practices](https://cloud.google.com/iam/docs/best-practices-for-securing-service-accounts)
- [Principle of Least Privilege](https://cloud.google.com/iam/docs/using-iam-securely#least_privilege)
