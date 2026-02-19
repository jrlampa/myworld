# IAM Permissions Setup for Cloud Run Deployment

## ⚠️ Important: One-Time Setup Required

The following IAM permissions must be configured **once** during initial setup. These permissions are **not** granted automatically during deployment to avoid requiring elevated `setIamPolicy` permissions for the GitHub Actions service account.

## 🔍 First: Identify Your Cloud Run Service Account

Cloud Run services use the **default compute service account**, not the App Engine service account. You need to identify the correct service account for your project.

### Find Your Service Account

```bash
# Method 1: Get from Cloud Run service description
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format="value(spec.template.spec.serviceAccountName)"

# Method 2: Check project default compute service account
gcloud iam service-accounts list \
  --project=sisrua-producao \
  --filter="email:compute@developer.gserviceaccount.com"
```

**Expected format**: `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`  
**Example for sisrua-producao**: `244319582382-compute@developer.gserviceaccount.com`

> **Note**: The service account uses your project **number** (not project ID). The format is `PROJECT_NUMBER-compute@developer.gserviceaccount.com`, **not** `PROJECT_ID@appspot.gserviceaccount.com`.

## Required IAM Permissions

### 1. Cloud Tasks Enqueuer Role

The default Cloud Run compute service account needs permission to create tasks in the Cloud Tasks queue.

**Service Account**: `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`  
**Role**: `roles/cloudtasks.enqueuer`

```bash
gcloud projects add-iam-policy-binding {PROJECT_ID} \
  --member="serviceAccount:{PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

**Example** (for project `sisrua-producao` with project number `244319582382`):
```bash
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

### 2. Cloud Run Invoker Role

The default Cloud Run compute service account needs permission to invoke Cloud Run services (for Cloud Tasks webhooks).

**Service**: `sisrua-app`  
**Region**: `southamerica-east1`  
**Service Account**: `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`  
**Role**: `roles/run.invoker`

```bash
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:{PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project={PROJECT_ID}
```

**Example** (for project `sisrua-producao` with project number `244319582382`):
```bash
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

## Why These Permissions Are Needed

### Cloud Tasks Enqueuer (`roles/cloudtasks.enqueuer`)
- **Purpose**: Allows the Cloud Run application to create tasks in the Cloud Tasks queue
- **Used For**: DXF file generation requests are queued as Cloud Tasks for asynchronous processing
- **Permissions Included**:
  - `cloudtasks.tasks.create` - Create new tasks
  - `cloudtasks.tasks.get` - Retrieve task information
  - `cloudtasks.queues.get` - Access queue information

### Cloud Run Invoker (`roles/run.invoker`)
- **Purpose**: Allows Cloud Tasks to invoke the Cloud Run webhook endpoint
- **Used For**: Cloud Tasks uses OIDC tokens to authenticate calls to `/api/tasks/process-dxf`
- **Permissions Included**:
  - `run.routes.invoke` - Invoke Cloud Run services

## How Cloud Tasks Works with Cloud Run

```
1. User requests DXF file generation
   ↓
2. Application creates a task in Cloud Tasks queue
   (Requires: roles/cloudtasks.enqueuer)
   ↓
3. Cloud Tasks schedules and executes the task
   ↓
4. Cloud Tasks calls webhook at /api/tasks/process-dxf
   (Requires: roles/run.invoker via OIDC token)
   ↓
5. Webhook processes DXF generation
   ↓
6. User receives the generated file
```

## Verification

### Check if permissions are already configured:

```bash
# Check Cloud Tasks enqueuer permission
gcloud projects get-iam-policy {PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/cloudtasks.enqueuer AND bindings.members:serviceAccount:{PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Check Cloud Run invoker permission
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project={PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/run.invoker"
```

**Example** (for project `sisrua-producao` with project number `244319582382`):
```bash
# Check Cloud Tasks enqueuer permission
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/cloudtasks.enqueuer AND bindings.members:serviceAccount:244319582382-compute@developer.gserviceaccount.com"

# Check Cloud Run invoker permission
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/run.invoker"
```

### Use the verification script:

```bash
cd sisrua_unified
./scripts/verify-cloud-tasks-permissions.sh {PROJECT_ID}
```

## Rollback (If Needed)

If you need to remove these permissions:

```bash
# Remove Cloud Tasks enqueuer role
gcloud projects remove-iam-policy-binding {PROJECT_ID} \
  --member="serviceAccount:{PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

# Remove Cloud Run invoker role
gcloud run services remove-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:{PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project={PROJECT_ID}
```

**Example** (for project `sisrua-producao` with project number `244319582382`):
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

## Understanding Service Account Types

### Why Not `@appspot.gserviceaccount.com`?

You might see references to `{PROJECT_ID}@appspot.gserviceaccount.com` in older documentation or examples. This is the **App Engine default service account**, which is only used by App Engine applications.

**Cloud Run uses a different service account**:
- **Format**: `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`
- **Name**: Default Compute Engine service account
- **Usage**: Used by Cloud Run, Compute Engine, and other compute services

### How to Find Your Project Number

```bash
# Get project number from project ID
gcloud projects describe {PROJECT_ID} --format="value(projectNumber)"

# Example
gcloud projects describe sisrua-producao --format="value(projectNumber)"
# Output: 244319582382
```

### Common Mistake

❌ **Wrong** (App Engine service account - doesn't exist for Cloud Run):
```bash
--member="serviceAccount:sisrua-producao@appspot.gserviceaccount.com"
```

✅ **Correct** (Compute Engine service account - used by Cloud Run):
```bash
--member="serviceAccount:244319582382-compute@developer.gserviceaccount.com"
```

## Troubleshooting

### Error: "INVALID_ARGUMENT" when using @appspot service account
If you get an error like `INVALID_ARGUMENT: The principal (user or service account) does not exist`, you're trying to use the wrong service account format.

**Cause**: You're using `{PROJECT_ID}@appspot.gserviceaccount.com` (App Engine service account) instead of the correct Compute Engine service account.

**Solution**: 
1. Find your project number: `gcloud projects describe {PROJECT_ID} --format="value(projectNumber)"`
2. Use the format: `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`
3. Re-run the IAM commands with the correct service account

### Error: "Cloud Tasks queue not found"
This error can occur even when the queue exists if the service account lacks permissions.

**Solution**: Grant the `roles/cloudtasks.enqueuer` permission as shown above.

### Error: "Permission denied"
The service account is missing one or both required roles.

**Solution**: Grant both permissions and wait 1-2 minutes for IAM changes to propagate.

### Permissions don't seem to work immediately
IAM permission changes can take 1-2 minutes to propagate across Google Cloud services.

**Solution**: Wait a few minutes and try again.

## Notes

- These permissions are **persistent** and only need to be configured once
- They should be configured **before** the first deployment
- The GitHub Actions service account does **not** need `setIamPolicy` permission
- These permissions apply to the **default compute service account**, not the GitHub Actions service account

## References

- [Cloud Tasks IAM Roles](https://cloud.google.com/tasks/docs/access-control)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [OIDC Tokens for Service-to-Service Authentication](https://cloud.google.com/run/docs/securing/service-identity#identity_tokens)
