# Complete Deployment Guide for sisrua-producao

## Prerequisites

Before deploying, ensure you have:

1. ✅ Google Cloud SDK (`gcloud`) installed and configured
2. ✅ Authenticated with appropriate permissions
3. ✅ Docker installed (if building locally)
4. ✅ Access to the `sisrua-producao` project

## Quick Start

For users who want to deploy immediately:

```bash
# 1. Setup IAM permissions (one-time)
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao

# 2. Deploy the application
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
  --update-env-vars="GROQ_API_KEY=your-key,GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue,NODE_ENV=production" \
  --project=sisrua-producao

# 3. Update with service URL
SERVICE_URL=$(gcloud run services describe sisrua-app --region=southamerica-east1 --format='value(status.url)' --project=sisrua-producao)
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --update-env-vars="CLOUD_RUN_BASE_URL=${SERVICE_URL}" \
  --project=sisrua-producao

# 4. Re-run IAM setup to grant invoker permissions (now that service exists)
cd ..
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao
```

## Detailed Step-by-Step Guide

### Phase 1: Initial Setup (One-Time)

#### 1.1 Authenticate with Google Cloud

```bash
# Login to your Google account
gcloud auth login

# Set the default project
gcloud config set project sisrua-producao

# Verify you're using the correct account
gcloud config list
```

#### 1.2 Enable Required APIs

```bash
# Enable all required APIs
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  cloudtasks.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project=sisrua-producao
```

#### 1.3 Create Cloud Tasks Queue

```bash
# Create the queue if it doesn't exist
gcloud tasks queues create sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=10

# Verify queue was created
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

#### 1.4 Setup IAM Permissions (Part 1 - Project Level)

```bash
# Run the automated setup script
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao

# Or manually:
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
echo "Project number: $PROJECT_NUMBER"

# Grant Cloud Tasks enqueuer to compute service account
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

### Phase 2: First Deployment

#### 2.1 Prepare Environment Variables

Create a file `sisrua_unified/.env.production` (do NOT commit this):

```bash
GROQ_API_KEY=your-groq-api-key-here
GCP_PROJECT=sisrua-producao
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=sisrua-queue
NODE_ENV=production
```

#### 2.2 Deploy to Cloud Run

**Option A: Deploy from source (recommended)**

```bash
cd sisrua_unified

# Load environment variables
export GROQ_API_KEY="your-groq-api-key"

# Deploy using source code
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

This will:
- Build the container using Cloud Build
- Push the image to Artifact Registry
- Deploy to Cloud Run
- Return the service URL

**Option B: Build locally and deploy**

```bash
cd sisrua_unified

# Build the Docker image
docker build -t gcr.io/sisrua-producao/sisrua-app:latest .

# Configure Docker authentication
gcloud auth configure-docker

# Push to Container Registry
docker push gcr.io/sisrua-producao/sisrua-app:latest

# Deploy the image
gcloud run deploy sisrua-app \
  --image=gcr.io/sisrua-producao/sisrua-app:latest \
  --region=southamerica-east1 \
  --platform=managed \
  --allow-unauthenticated \
  --memory=1024Mi \
  --cpu=2 \
  --timeout=300 \
  --update-env-vars="GROQ_API_KEY=${GROQ_API_KEY},GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue,NODE_ENV=production" \
  --project=sisrua-producao
```

#### 2.3 Capture and Update Service URL

```bash
# Get the deployed service URL
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

echo "Service URL: $SERVICE_URL"

# Update the service with its own URL (needed for Cloud Tasks callbacks)
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --update-env-vars="CLOUD_RUN_BASE_URL=${SERVICE_URL}" \
  --project=sisrua-producao
```

### Phase 3: Post-Deployment Configuration

#### 3.1 Setup IAM Permissions (Part 2 - Service Level)

Now that the service exists, grant the invoker role:

```bash
# Run the setup script again
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao

# Or manually:
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")

# Grant Cloud Run invoker to compute service account
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

#### 3.2 Verify IAM Permissions

```bash
# Verify Cloud Tasks enqueuer
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter='bindings.role=roles/cloudtasks.enqueuer' \
  --format="table(bindings.role,bindings.members)"

# Verify Cloud Run invoker
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --flatten="bindings[].members" \
  --filter='bindings.role=roles/run.invoker' \
  --format="table(bindings.role,bindings.members)"
```

Expected output should show both `allUsers` and your service account for the invoker role.

#### 3.3 Test the Deployment

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

# Test health endpoint
curl "${SERVICE_URL}/health"

# Should return: {"status":"healthy"}

# View service details
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Phase 4: Subsequent Deployments

For updates after initial deployment:

```bash
cd sisrua_unified

# Deploy updates
gcloud run deploy sisrua-app \
  --source=. \
  --region=southamerica-east1 \
  --project=sisrua-producao

# No need to re-grant permissions or update service URL
```

Or use the GitHub Actions workflow by pushing to the `main` branch.

## Troubleshooting

### Issue: "Image not found"

**Problem**: Deployment fails with `Image 'gcr.io/sisrua-producao/sisrua-app:latest' not found`

**Solution**: Use `--source=.` instead of `--image=...` to build automatically, or build and push the image first.

### Issue: "Permission denied" when creating tasks

**Problem**: Application can create tasks but gets permission errors

**Solution**: Ensure the service account has `roles/cloudtasks.enqueuer`:

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

### Issue: "Webhook returns 401/403"

**Problem**: Cloud Tasks can't invoke the webhook endpoint

**Solution**: Grant `roles/run.invoker` to the service account:

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

### Issue: Service account doesn't exist

**Problem**: `INVALID_ARGUMENT: The principal does not exist`

**Solution**: Verify you're using the correct service account format:

```bash
# Get project number
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")

# Correct format: {PROJECT_NUMBER}-compute@developer.gserviceaccount.com
echo "Service account: ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# List all service accounts to verify
gcloud iam service-accounts list --project=sisrua-producao
```

### Issue: Can't access logs

**Problem**: Need to debug deployment issues

**Solution**: View Cloud Run logs:

```bash
# View recent logs
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=100

# Follow logs in real-time
gcloud run services logs tail sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

## Monitoring

### View Service Metrics

```bash
# Service details
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao

# List revisions
gcloud run revisions list \
  --service=sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Check Cloud Tasks Queue

```bash
# Queue status
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao

# List tasks
gcloud tasks list \
  --queue=sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

## Automated Deployment with GitHub Actions

The repository includes automated deployment via GitHub Actions.

### Required Secrets

Configure these in GitHub repository settings → Secrets and variables → Actions:

1. **GCP_WIF_PROVIDER**: Workload Identity Federation provider
   - Format: `projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{POOL}/providers/{PROVIDER}`

2. **GCP_SERVICE_ACCOUNT**: GitHub Actions service account email
   - Format: `github-actions@sisrua-producao.iam.gserviceaccount.com`

3. **GCP_PROJECT_ID**: `sisrua-producao`

4. **GCP_PROJECT**: `sisrua-producao`

5. **GROQ_API_KEY**: Your Groq API key

### Trigger Deployment

```bash
# Push to main branch
git push origin main

# Or manually trigger via GitHub Actions UI
```

The workflow will automatically:
- Enable required APIs
- Create Cloud Tasks queue if needed
- Build and deploy the application
- Update environment variables

**Note**: IAM permissions still need to be configured manually once (use the setup script).

## Security Checklist

- [ ] Never commit API keys or secrets to git
- [ ] Use environment variables for sensitive data
- [ ] Grant minimum required permissions
- [ ] Review IAM permissions regularly
- [ ] Enable Cloud Audit Logs
- [ ] Use Workload Identity Federation for CI/CD
- [ ] Keep dependencies updated
- [ ] Monitor Cloud Run logs for errors

## Cost Optimization

- [ ] Set `--min-instances=0` for development (already configured)
- [ ] Set appropriate `--max-instances` based on traffic
- [ ] Monitor usage in Cloud Console
- [ ] Clean up old container images periodically
- [ ] Use Cloud Run's automatic scaling

## References

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Tasks Documentation](https://cloud.google.com/tasks/docs)
- [IAM Best Practices](https://cloud.google.com/iam/docs/best-practices)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [GitHub Actions with Google Cloud](https://github.com/google-github-actions)

## Getting Help

If you encounter issues:

1. Check the troubleshooting guide: [IAM_DEPLOYMENT_TROUBLESHOOTING.md](./IAM_DEPLOYMENT_TROUBLESHOOTING.md)
2. Review Cloud Run logs: `gcloud run services logs read sisrua-app --region=southamerica-east1 --project=sisrua-producao`
3. Check IAM permissions: `./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao`
4. Review GitHub Actions documentation: [.github/README.md](./.github/README.md)
