# Deployment Guide - Google Cloud Run with GitHub Actions

## Overview

This guide will help you set up automatic deployment of the sisrua-app to Google Cloud Run using GitHub Actions. The deployment will be triggered automatically every time you push to the `main` branch.

## What Has Been Configured

✅ **GitHub Actions Workflow** (`.github/workflows/deploy-cloud-run.yml`)
- Triggers on push to `main` branch
- Can also be manually triggered from the Actions tab
- Deploys to Cloud Run with all required configurations

✅ **Dockerfile** (`sisrua_unified/Dockerfile`)
- Multi-stage build for optimized image size
- Includes Node.js and Python dependencies
- Serves frontend and backend in a single container

✅ **Production Server Configuration**
- Serves static frontend files in production mode
- Uses dynamic base URL from environment variable
- Properly configured for Cloud Run (port 8080)

## Required Setup Steps

### 1. Configure GitHub Secrets

You need to add the following secrets to your GitHub repository:

#### Navigate to Repository Settings
1. Go to your repository on GitHub: https://github.com/jrlampa/myworld
2. Click on **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

#### Add `GCP_SA_KEY` Secret

Create a Google Cloud Service Account with deployment permissions:

```bash
# Set your project ID
PROJECT_ID="sisrua-producao"

# Create service account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deployment" \
    --project=$PROJECT_ID

# Grant required roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

# Create and download the key
gcloud iam service-accounts keys create key.json \
    --iam-account=github-actions@${PROJECT_ID}.iam.gserviceaccount.com
```

Then:
1. Open the `key.json` file
2. Copy the entire JSON content
3. In GitHub, create a new secret named `GCP_SA_KEY`
4. Paste the JSON content as the secret value
5. **Delete the `key.json` file from your local machine** for security

#### Add `GROQ_API_KEY` Secret

1. Go to [GROQ Console](https://console.groq.com/)
2. Sign in and generate an API key
3. In GitHub, create a new secret named `GROQ_API_KEY`
4. Paste your GROQ API key as the secret value

### 2. Enable Required Google Cloud APIs

Make sure the following APIs are enabled in your GCP project:

```bash
gcloud services enable run.googleapis.com --project=sisrua-producao
gcloud services enable cloudbuild.googleapis.com --project=sisrua-producao
gcloud services enable artifactregistry.googleapis.com --project=sisrua-producao
```

### 3. Test the Workflow

Once secrets are configured:

1. Push a commit to the `main` branch
2. Go to the **Actions** tab in your GitHub repository
3. Watch the deployment workflow execute
4. Once complete, your app will be live at the Cloud Run URL

Alternatively, you can manually trigger the workflow:
1. Go to **Actions** tab
2. Select "Deploy to Cloud Run" workflow
3. Click "Run workflow"
4. Select the `main` branch
5. Click "Run workflow"

## Environment Variables

The following environment variables are automatically set during deployment:

- `GROQ_API_KEY`: Your GROQ API key (from GitHub secrets)
- `GCP_PROJECT`: sisrua-producao
- `CLOUD_TASKS_LOCATION`: southamerica-east1
- `CLOUD_TASKS_QUEUE`: sisrua-queue
- `CLOUD_RUN_BASE_URL`: https://sisrua-app-244319582382.southamerica-east1.run.app
- `NODE_ENV`: production
- `PORT`: 8080 (managed by Cloud Run)

## Manual Deployment

If you need to deploy manually (without GitHub Actions):

```bash
cd sisrua_unified
gcloud run deploy sisrua-app \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --memory 1024Mi \
  --set-env-vars="GROQ_API_KEY=your-key-here,GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue,CLOUD_RUN_BASE_URL=https://sisrua-app-244319582382.southamerica-east1.run.app"
```

## Monitoring and Logs

### View Deployment Logs
- **GitHub**: Actions tab → Select workflow run
- **GCP Console**: [Cloud Run Console](https://console.cloud.google.com/run?project=sisrua-producao)

### View Application Logs
```bash
gcloud run logs read sisrua-app \
  --region southamerica-east1 \
  --project sisrua-producao
```

Or use the [Cloud Run Logs in Console](https://console.cloud.google.com/run/detail/southamerica-east1/sisrua-app/logs?project=sisrua-producao)

## Troubleshooting

### Deployment Fails with "Permission Denied"
- Verify the service account has all required roles
- Check that the `GCP_SA_KEY` secret is correctly formatted JSON

### Build Fails
- Check the workflow logs in GitHub Actions
- Verify the Dockerfile is correct
- Ensure all dependencies in `package.json` and `requirements.txt` are valid

### App Not Accessible
- Verify the service is deployed: `gcloud run services list --project=sisrua-producao`
- Check that `--allow-unauthenticated` is set
- Review application logs for runtime errors

### Environment Variables Not Working
- Verify secrets are set in GitHub repository settings
- Check the workflow file has the correct secret names
- Review Cloud Run service configuration in GCP Console

## Next Steps

1. ✅ Configure GitHub secrets (GCP_SA_KEY, GROQ_API_KEY)
2. ✅ Enable required GCP APIs
3. ✅ Merge this PR to your main branch
4. ✅ Monitor the first automatic deployment
5. ✅ Verify the deployed application is working correctly

## Support

For issues with:
- **GitHub Actions**: Check the Actions tab and workflow logs
- **Google Cloud**: Review Cloud Run logs and service details
- **Application**: Check application logs in Cloud Run

## Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GROQ API Documentation](https://console.groq.com/docs)
