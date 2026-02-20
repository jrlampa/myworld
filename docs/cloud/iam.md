# IAM & Permissions

This document covers Identity and Access Management (IAM) setup for the SIS RUA application on Google Cloud.

## Service Account

Cloud Run uses the **Compute Engine default service account** (not App Engine):

```
{PROJECT_NUMBER}-compute@developer.gserviceaccount.com
```

For project `sisrua-producao` (project number `244319582382`):
```
244319582382-compute@developer.gserviceaccount.com
```

> ⚠️ **Important**: Do NOT use `sisrua-producao@appspot.gserviceaccount.com` — that is the App Engine service account and does NOT exist for Cloud Run deployments.

### Find Your Project Number

```bash
gcloud projects describe sisrua-producao --format="value(projectNumber)"
```

### Find Your Service Account

```bash
gcloud iam service-accounts list \
  --project=sisrua-producao \
  --filter="email~compute@developer.gserviceaccount.com"
```

## Required IAM Roles

| Role | Purpose | Where Granted |
|------|---------|---------------|
| `roles/cloudtasks.enqueuer` | Create tasks in Cloud Tasks queue | Project level |
| `roles/run.invoker` | Allow Cloud Tasks to call the webhook | Cloud Run service level |

## One-Time Setup Script

Use the automated script for initial setup:

```bash
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao
```

## Manual Setup Commands

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# 1. Grant Cloud Tasks enqueuer role
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudtasks.enqueuer"

# 2. Grant Cloud Run invoker role (after service exists)
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

## Verification

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Check Cloud Tasks enqueuer
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/cloudtasks.enqueuer AND bindings.members:serviceAccount:${SERVICE_ACCOUNT}"

# Check Cloud Run invoker
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/run.invoker"
```

## OIDC Configuration

OIDC (OpenID Connect) authentication secures the Cloud Tasks webhook endpoint `/api/tasks/process-dxf`.

### Required Environment Variables

```bash
# Service account used by Cloud Tasks
GCP_SERVICE_ACCOUNT=your-service-account@your-project.iam.gserviceaccount.com

# Cloud Run service URL (for audience validation)
CLOUD_RUN_SERVICE_URL=https://your-service-name.run.app
```

### Get Service Account

```bash
SERVICE_ACCOUNT=$(gcloud iam service-accounts list \
  --filter="email~cloudtasks" \
  --format="value(email)")
echo $SERVICE_ACCOUNT
```

### Get Cloud Run URL

```bash
CLOUD_RUN_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)')
echo $CLOUD_RUN_URL
```

### Set as GitHub Secrets

```bash
gh secret set GCP_SERVICE_ACCOUNT --body="${SERVICE_ACCOUNT}" --repo jrlampa/myworld
gh secret set CLOUD_RUN_SERVICE_URL --body="${CLOUD_RUN_URL}" --repo jrlampa/myworld
```

## Workload Identity Federation

GitHub Actions uses Workload Identity Federation for secure authentication (no stored credentials).

### Setup

```bash
# Create identity pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool"

# Create OIDC provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='jrlampa/myworld'"

# Get provider ID (use as GCP_WIF_PROVIDER secret)
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)"

# Allow GitHub Actions to impersonate the service account
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
gcloud iam service-accounts add-iam-policy-binding \
  "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/jrlampa/myworld"
```

## Troubleshooting

### INVALID_ARGUMENT Error

**Cause**: Using the wrong service account format (e.g., `@appspot.gserviceaccount.com`).

**Fix**: Use `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`.

### setIamPolicy Permission Denied

**Cause**: The deploy service account doesn't have permission to modify IAM policies.

**Resolution**: This is correct by design. IAM permissions should be configured manually by an account with Owner or IAM Admin permissions. Never grant `setIamPolicy` to the deployment service account.

### Cloud Run Invoker Missing After Redeploy

When deleting and recreating a Cloud Run service, the service-level IAM bindings are lost. Re-run the IAM setup script after each service recreation.

## Security Best Practices

1. **Least Privilege**: Deploy service accounts should NOT have `setIamPolicy` permission
2. **Separation of Concerns**: IAM setup is separate from deployment
3. **One-Time Setup**: Configure IAM once, not on every deployment
4. **Workload Identity**: Use federation instead of service account keys
5. **Audit Logs**: Monitor IAM changes via Cloud Audit Logs
