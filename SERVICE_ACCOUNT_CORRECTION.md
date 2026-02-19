# Service Account Correction - Implementation Complete

## Overview

Updated all documentation and code to use the correct Cloud Run service account format after discovering that Cloud Run uses the **default compute service account**, not the App Engine service account.

## Discovered Facts

### What Was Wrong

**Incorrect Service Account** (documentation and code):
```
sisrua-producao@appspot.gserviceaccount.com
```

This is the **App Engine default service account** which:
- ❌ Does **not exist** for Cloud Run deployments
- ❌ Only exists if you have an App Engine application
- ❌ Causes `INVALID_ARGUMENT` errors when trying to grant IAM permissions

### What Is Correct

**Correct Service Account** (actually used by Cloud Run):
```
244319582382-compute@developer.gserviceaccount.com
```

This is the **Compute Engine default service account** which:
- ✅ Is automatically used by Cloud Run services
- ✅ Format: `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`
- ✅ Can be granted IAM permissions successfully

## Implementation Status

✅ **Permissions Successfully Applied**

The following IAM permissions were successfully granted to `244319582382-compute@developer.gserviceaccount.com`:

1. **`roles/cloudtasks.enqueuer`** at project level
   - Allows Cloud Run to create tasks in Cloud Tasks queue
   
2. **`roles/run.invoker`** on Cloud Run service `sisrua-app` (southamerica-east1)
   - Allows Cloud Tasks to invoke the Cloud Run webhook via OIDC

## Changes Made

### 1. Documentation Updates

#### `.github/IAM_SETUP_REQUIRED.md`
- ✅ Added section to identify the correct service account
- ✅ Updated all examples to use `244319582382-compute@developer.gserviceaccount.com`
- ✅ Added commands to find project number
- ✅ Explained difference between App Engine and Compute service accounts
- ✅ Added rollback commands with correct service account
- ✅ Added troubleshooting for `INVALID_ARGUMENT` error

#### `CLOUD_RUN_DEPLOYMENT_FIX.md`
- ✅ Updated "Required Manual Action" section with correct service account
- ✅ Added step to find project number
- ✅ Updated verification commands
- ✅ Added rollback commands
- ✅ Added warning about NOT using @appspot service account

### 2. Code Updates

#### `sisrua_unified/server/services/cloudTasksService.ts`
- ✅ **Removed hardcoded service account** from `oidcToken.serviceAccountEmail`
- ✅ Updated to use Cloud Run's default service account automatically
- ✅ Updated error messages to provide correct service account format
- ✅ Added instructions to find project number in error messages
- ✅ Added reference to `.github/IAM_SETUP_REQUIRED.md` in error messages

**Before:**
```typescript
oidcToken: {
    serviceAccountEmail: `${GCP_PROJECT}@appspot.gserviceaccount.com`,
},
```

**After:**
```typescript
oidcToken: {
    // Omit serviceAccountEmail to use the default service account that Cloud Run uses
    // This will be the compute service account: {PROJECT_NUMBER}-compute@developer.gserviceaccount.com
},
```

This approach is recommended because:
- It automatically uses the correct service account
- Avoids hardcoding service account emails
- Works consistently across different projects

## Verification

### ✅ TypeScript Compilation
```bash
cd sisrua_unified
npx tsc --noEmit -p tsconfig.server.json
# No errors
```

### ✅ IAM Permissions Verified

The correct permissions have been applied and verified:

```bash
# Cloud Tasks enqueuer permission
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/cloudtasks.enqueuer AND bindings.members:serviceAccount:244319582382-compute@developer.gserviceaccount.com"

# Cloud Run invoker permission
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/run.invoker"
```

## How to Find Your Service Account

For any Google Cloud project:

```bash
# Step 1: Get your project number
gcloud projects describe {PROJECT_ID} --format="value(projectNumber)"

# Step 2: Construct the service account email
# Format: {PROJECT_NUMBER}-compute@developer.gserviceaccount.com

# Example for sisrua-producao:
gcloud projects describe sisrua-producao --format="value(projectNumber)"
# Output: 244319582382
# Service Account: 244319582382-compute@developer.gserviceaccount.com
```

## Rollback (If Needed)

If you need to remove the permissions:

```bash
gcloud projects remove-iam-policy-binding sisrua-producao \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

gcloud run services remove-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

## Audit Checklist

For compliance and audit purposes:

### Export IAM Policies (After Changes)
```bash
# Export project-level IAM policy
gcloud projects get-iam-policy sisrua-producao --format=json > iam-project-after.json

# Export Cloud Run service IAM policy
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format=json > iam-run-after.json
```

### Check Cloud Audit Logs
```bash
# View recent SetIamPolicy operations
gcloud logging read "protoPayload.methodName=SetIamPolicy" \
  --project=sisrua-producao \
  --limit=50 \
  --format=json
```

## Key Learnings

### Service Account Types in Google Cloud

1. **App Engine Default Service Account**
   - Format: `{PROJECT_ID}@appspot.gserviceaccount.com`
   - Used by: App Engine applications only
   - Created when: You create an App Engine application
   - **Not used by Cloud Run**

2. **Compute Engine Default Service Account**
   - Format: `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`
   - Used by: Compute Engine, Cloud Run, and other compute services
   - Created automatically: When project is created
   - **This is what Cloud Run uses**

### Why This Matters

When creating Cloud Tasks with OIDC tokens:
- If you specify a service account that doesn't exist → `INVALID_ARGUMENT` error
- If you omit the service account → Uses the caller's default service account
- For Cloud Run → The default is the compute service account

## Files Modified

| File | Type | Changes |
|------|------|---------|
| `.github/IAM_SETUP_REQUIRED.md` | Updated | Added service account discovery, updated all examples |
| `CLOUD_RUN_DEPLOYMENT_FIX.md` | Updated | Updated manual action section with correct service account |
| `sisrua_unified/server/services/cloudTasksService.ts` | Updated | Removed hardcoded service account, updated error messages |
| `SERVICE_ACCOUNT_CORRECTION.md` | New | This documentation |

## References

- [Cloud Run Service Identity](https://cloud.google.com/run/docs/securing/service-identity)
- [Default Service Accounts](https://cloud.google.com/iam/docs/service-account-types#default)
- [Cloud Tasks OIDC Tokens](https://cloud.google.com/tasks/docs/creating-http-target-tasks#token)
- [Service Account Email Formats](https://cloud.google.com/iam/docs/service-accounts#user-managed)

## Next Steps

1. ✅ Documentation updated with correct service account
2. ✅ Code updated to use default service account automatically
3. ✅ TypeScript compilation verified
4. ✅ Permissions successfully applied
5. ✅ Ready for deployment

The Cloud Run deployment should now work correctly with Cloud Tasks!
