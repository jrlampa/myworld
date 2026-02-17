# GitHub Actions Setup

This repository uses GitHub Actions for automatic deployment to Google Cloud Run.

## Required Secrets

The following secrets need to be configured in your GitHub repository settings (Settings > Secrets and variables > Actions):

### `GCP_SA_KEY`
A JSON key for a Google Cloud Service Account with the following permissions:
- Cloud Run Admin
- Service Account User
- Artifact Registry Writer (if using Artifact Registry)

To create this key:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to IAM & Admin > Service Accounts
3. Create a new service account or select an existing one
4. Grant the required roles listed above
5. Create a JSON key for the service account
6. Copy the entire JSON content and add it as a secret named `GCP_SA_KEY`

### `GROQ_API_KEY`
Your GROQ API key for AI-powered location search and analysis features.

To obtain this key:
1. Visit [GROQ Console](https://console.groq.com/)
2. Create an account or sign in
3. Generate an API key
4. Add the key as a secret named `GROQ_API_KEY`

## Workflow Configuration

The workflow is configured in `.github/workflows/deploy-cloud-run.yml` and will:

1. Trigger on every push to the `main` branch
2. Can also be manually triggered from the Actions tab
3. Authenticate to Google Cloud using the service account
4. Deploy to Cloud Run with the following configuration:
   - Service: `sisrua-app`
   - Region: `southamerica-east1`
   - Memory: 1024Mi
   - Public access (unauthenticated)
   - Environment variables for GROQ, GCP project, and Cloud Tasks

## Manual Deployment

You can also deploy manually using:

```bash
cd sisrua_unified
gcloud run deploy sisrua-app \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --memory 1024Mi \
  --set-env-vars="GROQ_API_KEY=<your-key>,GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue,CLOUD_RUN_BASE_URL=https://sisrua-app-244319582382.southamerica-east1.run.app"
```

## Monitoring Deployments

You can monitor deployments in:
- GitHub Actions tab in your repository
- [Google Cloud Run Console](https://console.cloud.google.com/run)
