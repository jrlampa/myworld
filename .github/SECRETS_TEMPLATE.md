# Secrets Template

## Copy this template to help you configure your GitHub Secrets

### Authentication Secrets (Required for GCP)

```
GCP_WIF_PROVIDER=projects/YOUR_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider

GCP_SERVICE_ACCOUNT=github-actions-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com

GCP_PROJECT_ID=sisrua-producao
```

### Application Secrets

```
GROQ_API_KEY=your_groq_api_key_here

GCP_PROJECT=sisrua-producao

CLOUD_RUN_BASE_URL=https://sisrua-app-XXXXXXXXXXXX.southamerica-east1.run.app
```

## How to Find These Values:

### 1. GCP_WIF_PROVIDER
Run this command after creating the Workload Identity Pool:
```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --project="sisrua-producao" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
```

### 2. GCP_SERVICE_ACCOUNT
Check your service accounts:
```bash
gcloud iam service-accounts list --project=sisrua-producao
```

### 3. GCP_PROJECT_ID
Your Google Cloud Project ID (usually same as project name)

### 4. GROQ_API_KEY
Your current API key from Groq dashboard

### 5. GCP_PROJECT
Same as GCP_PROJECT_ID (used in environment variables)

### 6. CLOUD_RUN_BASE_URL
After first deployment, get it from:
```bash
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format="value(status.url)"
```

Or from Google Cloud Console > Cloud Run > sisrua-app > URL

## Notes:

- Never commit this file with real values to version control
- Store the actual secrets in GitHub Settings > Secrets and variables > Actions
- Each secret should be added individually in the GitHub UI
