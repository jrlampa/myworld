# IAM and Deployment Troubleshooting Guide

## Overview

This guide addresses the specific issues encountered during Cloud Run deployment and IAM permission configuration for the sisrua-producao project.

## Issue Analysis

Based on the deployment output, there are three main issues to address:

### 1. ✅ Cloud Tasks Enqueuer Permission - RESOLVED
**Status**: Successfully configured

The following service accounts now have `roles/cloudtasks.enqueuer`:
- `244319582382-compute@developer.gserviceaccount.com` (Compute Engine default)
- `sisrua-producao@appspot.gserviceaccount.com` (App Engine default)

**Verification**:
```bash
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter='bindings.role=roles/cloudtasks.enqueuer' \
  --format="table(bindings.role,bindings.members)"
```

**Expected output**:
```
ROLE: roles/cloudtasks.enqueuer
MEMBERS: serviceAccount:244319582382-compute@developer.gserviceaccount.com
ROLE: roles/cloudtasks.enqueuer
MEMBERS: serviceAccount:sisrua-producao@appspot.gserviceaccount.com
```

### 2. ⚠️ Cloud Run Invoker Permission - NEEDS ATTENTION
**Status**: Currently allows `allUsers` (public access)

**Current state**:
```bash
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --flatten="bindings[].members" \
  --filter='bindings.role=roles/run.invoker' \
  --format="table(bindings.role,bindings.members)" \
  --project=sisrua-producao
```

**Current output**:
```
ROLE: roles/run.invoker
MEMBERS: allUsers
```

**Why this is happening**: The deployment uses `--allow-unauthenticated` flag, which adds `allUsers` to the invoker role.

**What needs to be fixed**: For Cloud Tasks webhooks to work with OIDC authentication, the service account needs explicit invoker permission.

**Solution**: Add the service account to invokers while keeping public access:

```bash
# Add compute service account as invoker (for Cloud Tasks OIDC)
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

After this, verification should show:
```
ROLE: roles/run.invoker
MEMBERS: allUsers

ROLE: roles/run.invoker
MEMBERS: serviceAccount:244319582382-compute@developer.gserviceaccount.com
```

**Alternative (More Secure)**: If you want to restrict access to only authenticated requests:

```bash
# Remove public access
gcloud run services remove-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project=sisrua-producao

# Add service account
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao

# Then deploy without --allow-unauthenticated flag
```

### 3. ❌ Container Image Not Found - NEEDS TO BE BUILT
**Status**: Image does not exist yet

**Error**:
```
ERROR: (gcloud.run.deploy) Image 'gcr.io/sisrua-producao/sisrua-app:latest' not found.
```

**Root cause**: The container image needs to be built and pushed to Google Container Registry before deployment.

**Solution - Option A: Build and push manually**:

```bash
# Navigate to the application directory
cd sisrua_unified

# Build the Docker image
docker build -t gcr.io/sisrua-producao/sisrua-app:latest .

# Configure Docker to use gcloud as credential helper
gcloud auth configure-docker

# Push the image to GCR
docker push gcr.io/sisrua-producao/sisrua-app:latest
```

**Solution - Option B: Use Cloud Build (recommended)**:

```bash
# Navigate to the application directory
cd sisrua_unified

# Build using Cloud Build (faster, no local Docker needed)
gcloud builds submit --tag gcr.io/sisrua-producao/sisrua-app:latest \
  --project=sisrua-producao

# Verify the image exists
gcloud container images list --repository=gcr.io/sisrua-producao --project=sisrua-producao
```

**Solution - Option C: Use `--source` flag (easiest)**:

The current deployment workflow already uses this approach:
```bash
cd sisrua_unified
gcloud run deploy sisrua-app \
  --source=. \
  --region=southamerica-east1 \
  --platform=managed \
  --allow-unauthenticated \
  --project=sisrua-producao
```

The `--source=.` flag automatically:
1. Builds the container image using Cloud Build
2. Pushes it to Artifact Registry (or GCR)
3. Deploys to Cloud Run

**Why the manual deployment failed**: The manual command specified `--image=gcr.io/sisrua-producao/sisrua-app:latest` without building it first.

## Complete Deployment Workflow

Here's the correct sequence to deploy from scratch:

### Step 1: Verify IAM Permissions

```bash
# Check Cloud Tasks enqueuer
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter='bindings.role=roles/cloudtasks.enqueuer' \
  --format="table(bindings.role,bindings.members)"

# Should show both service accounts
```

### Step 2: Add Cloud Run Invoker for Service Account

```bash
# Add the compute service account as invoker
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao

# Note: This requires the service to exist first, so you might need to do this after initial deployment
```

### Step 3: Deploy Using Source (Recommended)

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
  --update-env-vars="GROQ_API_KEY=${GROQ_API_KEY},GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue,NODE_ENV=production" \
  --project=sisrua-producao
```

### Step 4: Update Service with Cloud Run URL

```bash
# Get the service URL
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

echo "Service URL: $SERVICE_URL"

# Update environment variable
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --update-env-vars="CLOUD_RUN_BASE_URL=${SERVICE_URL}"
```

### Step 5: Add Service Account Invoker Permission (if service didn't exist before)

```bash
# Now add the service account invoker permission
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

### Step 6: Verify Everything

```bash
# Verify the service is running
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format='value(status.conditions[0].status)'
# Should return "True"

# Verify IAM permissions
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao

# Test the health endpoint
curl $(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)/health
```

## Understanding Service Accounts

### Which Service Account Does Cloud Run Use?

When you deploy to Cloud Run **without** specifying a service account, it uses the **default Compute Engine service account**:

```
244319582382-compute@developer.gserviceaccount.com
```

To explicitly specify a service account during deployment:
```bash
gcloud run deploy sisrua-app \
  --service-account=sisrua-producao@appspot.gserviceaccount.com \
  ...
```

**However**, the current deployment does **not** specify a service account, so it uses the compute service account by default.

### Service Account Comparison

| Service Account | Format | Used By | Exists? |
|----------------|--------|---------|---------|
| Compute Engine Default | `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com` | Cloud Run (default), Compute Engine, GKE | ✅ Always exists |
| App Engine Default | `{PROJECT_ID}@appspot.gserviceaccount.com` | App Engine apps | ✅ Exists for sisrua-producao |

**Current deployment** uses: `244319582382-compute@developer.gserviceaccount.com`

### To Use App Engine Service Account Instead

If you want to use the App Engine service account (`sisrua-producao@appspot.gserviceaccount.com`), add this flag to the deployment:

```bash
gcloud run deploy sisrua-app \
  --service-account=sisrua-producao@appspot.gserviceaccount.com \
  ...
```

Then update the IAM permissions to use that service account instead:
```bash
# Add App Engine service account as invoker
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:sisrua-producao@appspot.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

## Common Errors and Solutions

### Error: "Permission denied" when creating Cloud Tasks

**Symptom**: Tasks fail to create with permission errors

**Cause**: Service account lacks `roles/cloudtasks.enqueuer`

**Solution**: Already granted ✅

### Error: "Webhook returns 401/403"

**Symptom**: Cloud Tasks created successfully but webhook calls fail with authentication errors

**Cause**: Service account lacks `roles/run.invoker` on the Cloud Run service

**Solution**: Run Step 5 above to add the invoker permission

### Error: "Service account does not exist"

**Symptom**: `INVALID_ARGUMENT: The principal does not exist`

**Cause**: Using wrong service account email format or service account doesn't exist

**Solution**: Verify service account exists:
```bash
gcloud iam service-accounts list --project=sisrua-producao
```

### Error: "Image not found"

**Symptom**: Deployment fails when specifying `--image=gcr.io/...`

**Cause**: Image hasn't been built and pushed yet

**Solution**: Either:
- Use `--source=.` to build automatically (recommended)
- Build and push image manually first

## Automation with GitHub Actions

The repository includes a GitHub Actions workflow that handles deployment automatically. To use it:

1. **Ensure these secrets are configured**:
   - `GCP_WIF_PROVIDER`: Workload Identity Federation provider
   - `GCP_SERVICE_ACCOUNT`: GitHub Actions service account email
   - `GCP_PROJECT_ID`: `sisrua-producao`
   - `GCP_PROJECT`: `sisrua-producao`
   - `GROQ_API_KEY`: API key for Groq service

2. **Push to trigger deployment**:
   ```bash
   git push origin main
   ```

3. **The workflow will**:
   - Enable required APIs
   - Create Cloud Tasks queue if needed
   - Build and deploy using `--source` flag
   - Update environment variables

4. **Manual IAM setup** (one-time):
   After first deployment succeeds, add the service account invoker permission:
   ```bash
   gcloud run services add-iam-policy-binding sisrua-app \
     --region=southamerica-east1 \
     --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
     --role="roles/run.invoker" \
     --project=sisrua-producao
   ```

## Security Best Practices

### Public vs Authenticated Access

**Current**: `--allow-unauthenticated` (public access)
- ✅ Allows anyone to access the service
- ✅ Good for public-facing web applications
- ⚠️ Ensure proper authentication at application level

**Alternative**: Authenticated access only
- ✅ Only authenticated service accounts can invoke
- ✅ Better security for internal services
- ❌ Requires authentication for all requests

### Principle of Least Privilege

Only grant permissions that are actually needed:

✅ **Good**:
- `roles/cloudtasks.enqueuer` - Only allows creating tasks
- `roles/run.invoker` - Only allows invoking Cloud Run

❌ **Avoid**:
- `roles/editor` - Too broad
- `roles/owner` - Administrative access

### Service Account Key Management

**Never**:
- Commit service account keys to git
- Store keys in environment variables
- Share keys via insecure channels

**Instead**:
- Use Workload Identity Federation for GitHub Actions
- Use default service accounts where possible
- Use short-lived tokens

## Monitoring and Troubleshooting

### Check Cloud Run Logs

```bash
# Recent logs
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=50

# Follow logs in real-time
gcloud run services logs tail sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Check Cloud Tasks Queue

```bash
# List tasks in queue
gcloud tasks list \
  --queue=sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao

# Describe queue
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

### Test DXF Generation

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

# Test health endpoint
curl $SERVICE_URL/health

# Test DXF generation (requires valid request body)
curl -X POST $SERVICE_URL/api/generate-dxf \
  -H "Content-Type: application/json" \
  -d '{"logradouro": "RUA EXEMPLO", "municipio": "SAO PAULO"}'
```

## Quick Reference

### Essential Commands

```bash
# Deploy from source (recommended)
cd sisrua_unified && gcloud run deploy sisrua-app --source=. --region=southamerica-east1 --project=sisrua-producao

# Add service account invoker
gcloud run services add-iam-policy-binding sisrua-app --region=southamerica-east1 --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" --role="roles/run.invoker" --project=sisrua-producao

# Check service status
gcloud run services describe sisrua-app --region=southamerica-east1 --project=sisrua-producao

# View logs
gcloud run services logs read sisrua-app --region=southamerica-east1 --project=sisrua-producao --limit=50
```

## Next Steps

1. ✅ Cloud Tasks enqueuer permission - Already configured
2. ⚠️ Add service account as Cloud Run invoker - **Action required**
3. ⚠️ Deploy using `--source` flag - **Action required**
4. ✅ Verify deployment and test DXF generation

## References

- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [Cloud Tasks OIDC Tokens](https://cloud.google.com/tasks/docs/creating-http-target-tasks#token)
- [Cloud Run Deployment](https://cloud.google.com/run/docs/deploying-source-code)
- [Service Account Types](https://cloud.google.com/iam/docs/service-account-types)
