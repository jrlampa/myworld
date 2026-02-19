# IAM Permissions Setup for Cloud Run Deployment

## ⚠️ Important: One-Time Setup Required

The following IAM permissions must be configured **once** during initial setup. These permissions are **not** granted automatically during deployment to avoid requiring elevated `setIamPolicy` permissions for the GitHub Actions service account.

## Required IAM Permissions

### 1. Cloud Tasks Enqueuer Role

The default Cloud Run service account needs permission to create tasks in the Cloud Tasks queue.

**Service Account**: `{PROJECT_ID}@appspot.gserviceaccount.com`  
**Role**: `roles/cloudtasks.enqueuer`

```bash
gcloud projects add-iam-policy-binding {PROJECT_ID} \
  --member="serviceAccount:{PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

**Example** (for project `sisrua-producao`):
```bash
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:sisrua-producao@appspot.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

### 2. Cloud Run Invoker Role

The default Cloud Run service account needs permission to invoke Cloud Run services (for Cloud Tasks webhooks).

**Service**: `sisrua-app`  
**Region**: `southamerica-east1`  
**Service Account**: `{PROJECT_ID}@appspot.gserviceaccount.com`  
**Role**: `roles/run.invoker`

```bash
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:{PROJECT_ID}@appspot.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project={PROJECT_ID}
```

**Example** (for project `sisrua-producao`):
```bash
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:sisrua-producao@appspot.gserviceaccount.com" \
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
  --filter="bindings.role:roles/cloudtasks.enqueuer AND bindings.members:serviceAccount:{PROJECT_ID}@appspot.gserviceaccount.com"

# Check Cloud Run invoker permission
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project={PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/run.invoker"
```

### Use the verification script:

```bash
cd sisrua_unified
./scripts/verify-cloud-tasks-permissions.sh {PROJECT_ID}
```

## Troubleshooting

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
