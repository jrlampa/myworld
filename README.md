# MyWorld - Cloud Deployment Documentation

This repository contains comprehensive documentation and scripts for deploying the SIS RUA application to Google Cloud Run.

## 📚 Documentation Index

### Quick Links

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Complete step-by-step deployment guide | First-time deployment or comprehensive reference |
| [IAM_DEPLOYMENT_TROUBLESHOOTING.md](./IAM_DEPLOYMENT_TROUBLESHOOTING.md) | Troubleshooting IAM and deployment issues | When encountering permission or deployment errors |
| [DEPLOYMENT_VERIFICATION_CHECKLIST.md](./DEPLOYMENT_VERIFICATION_CHECKLIST.md) | Verification checklist for deployments | After deployment to verify everything works |
| [sisrua_unified/README.md](./sisrua_unified/README.md) | Application documentation | Understanding the application structure |

### Existing Documentation

This repository also contains extensive historical documentation about the project. Key documents include:

- **Cloud Run & Cloud Tasks**: `CLOUD_RUN_DEPLOYMENT_FIX.md`, `CLOUD_TASKS_QUEUE_FIX_SUMMARY.md`
- **Service Accounts**: `SERVICE_ACCOUNT_CORRECTION.md`
- **Deployment**: `GUIA_DEPLOY.md`, `DEPLOY_DO_ZERO.md`
- **Security**: `SECURITY_DEPLOYMENT_AUDIT.md`

## 🚀 Quick Start

### Prerequisites

- Google Cloud SDK (`gcloud`) installed
- Docker installed (optional, for local builds)
- Access to the `sisrua-producao` GCP project
- Repository cloned locally

### One-Time Setup

1. **Configure IAM Permissions**:
   ```bash
   ./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao
   ```

2. **Enable Required APIs** (if not already enabled):
   ```bash
   gcloud services enable cloudresourcemanager.googleapis.com cloudtasks.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project=sisrua-producao
   ```

### Deploy

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
  --project=sisrua-producao \
  --update-env-vars="GROQ_API_KEY=your-key,GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue,NODE_ENV=production"
```

### Post-Deployment

1. **Update service URL**:
   ```bash
   SERVICE_URL=$(gcloud run services describe sisrua-app --region=southamerica-east1 --format='value(status.url)' --project=sisrua-producao)
   gcloud run services update sisrua-app --region=southamerica-east1 --update-env-vars="CLOUD_RUN_BASE_URL=${SERVICE_URL}" --project=sisrua-producao
   ```

2. **Grant invoker permissions** (if service didn't exist before):
   ```bash
   ./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao
   ```

3. **Verify deployment**:
   ```bash
   curl $(gcloud run services describe sisrua-app --region=southamerica-east1 --format='value(status.url)' --project=sisrua-producao)/health
   ```

## 🔧 Tools & Scripts

### IAM Setup Script

**Location**: `sisrua_unified/scripts/setup-iam-permissions.sh`

**Purpose**: Automates the configuration of IAM permissions for Cloud Run and Cloud Tasks.

**Usage**:
```bash
./sisrua_unified/scripts/setup-iam-permissions.sh [PROJECT_ID] [REGION] [SERVICE_NAME] [QUEUE_NAME]
```

**Defaults**:
- PROJECT_ID: `sisrua-producao`
- REGION: `southamerica-east1`
- SERVICE_NAME: `sisrua-app`
- QUEUE_NAME: `sisrua-queue`

**What it does**:
1. Identifies the project number and service accounts
2. Grants `roles/cloudtasks.enqueuer` to service accounts
3. Grants `roles/run.invoker` to service accounts (if service exists)
4. Verifies all permissions are configured correctly

## 🔍 Understanding the Problem Statement

The original problem statement showed three key issues during deployment:

### Issue 1: Cloud Tasks Enqueuer Permission ✅ RESOLVED

Both service accounts successfully received the `roles/cloudtasks.enqueuer` permission:
- `244319582382-compute@developer.gserviceaccount.com`
- `sisrua-producao@appspot.gserviceaccount.com`

### Issue 2: Cloud Run Invoker Permission ⚠️ NEEDS ATTENTION

The Cloud Run service shows `allUsers` as invoker (due to `--allow-unauthenticated`), but the service account also needs explicit invoker permission for Cloud Tasks OIDC authentication.

**Solution**: Add service account to invokers:
```bash
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

### Issue 3: Image Not Found ❌ NEEDS BUILD

The deployment failed because the container image doesn't exist yet.

**Solution**: Use `--source=.` flag to build automatically:
```bash
cd sisrua_unified
gcloud run deploy sisrua-app --source=. --region=southamerica-east1 --project=sisrua-producao
```

This automatically:
- Builds the container using Cloud Build
- Pushes to Artifact Registry
- Deploys to Cloud Run

## 📖 Documentation Structure

```
myworld/
├── README.md (this file)                              # Overview and quick start
├── DEPLOYMENT_GUIDE.md                                # Complete deployment guide
├── IAM_DEPLOYMENT_TROUBLESHOOTING.md                  # Troubleshooting specific issues
├── DEPLOYMENT_VERIFICATION_CHECKLIST.md               # Verification checklist
├── sisrua_unified/
│   ├── README.md                                      # Application documentation
│   ├── scripts/
│   │   └── setup-iam-permissions.sh                   # IAM automation script
│   ├── Dockerfile                                     # Container definition
│   └── ...                                            # Application code
└── [historical documentation files]                   # Previous guides and reports
```

## 🎯 Common Tasks

### View Service Logs
```bash
gcloud run services logs read sisrua-app --region=southamerica-east1 --project=sisrua-producao --limit=50
```

### Check Queue Status
```bash
gcloud tasks queues describe sisrua-queue --location=southamerica-east1 --project=sisrua-producao
```

### List Tasks in Queue
```bash
gcloud tasks list --queue=sisrua-queue --location=southamerica-east1 --project=sisrua-producao
```

### Verify IAM Permissions
```bash
# Cloud Tasks enqueuer
gcloud projects get-iam-policy sisrua-producao --flatten="bindings[].members" --filter='bindings.role=roles/cloudtasks.enqueuer' --format="table(bindings.members)"

# Cloud Run invoker
gcloud run services get-iam-policy sisrua-app --region=southamerica-east1 --project=sisrua-producao --flatten="bindings[].members" --filter='bindings.role=roles/run.invoker' --format="table(bindings.members)"
```

### Update Environment Variables
```bash
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --update-env-vars="NEW_VAR=value" \
  --project=sisrua-producao
```

## 🔐 Service Account Information

### Compute Engine Default Service Account

**Format**: `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`  
**For sisrua-producao**: `244319582382-compute@developer.gserviceaccount.com`

This is the service account used by Cloud Run by default.

### App Engine Default Service Account

**Format**: `{PROJECT_ID}@appspot.gserviceaccount.com`  
**For sisrua-producao**: `sisrua-producao@appspot.gserviceaccount.com`

This service account exists but is NOT used by Cloud Run unless explicitly specified.

### How to Find Your Service Account

```bash
# Get project number
gcloud projects describe sisrua-producao --format="value(projectNumber)"

# List all service accounts
gcloud iam service-accounts list --project=sisrua-producao
```

## 🚨 Troubleshooting

### Problem: "Permission denied" when creating tasks

**Solution**: Grant Cloud Tasks enqueuer role:
```bash
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao
```

### Problem: "Webhook returns 401/403"

**Solution**: Grant Cloud Run invoker role:
```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

### Problem: "Image not found"

**Solution**: Use `--source=.` instead of `--image=...`:
```bash
cd sisrua_unified
gcloud run deploy sisrua-app --source=. --region=southamerica-east1 --project=sisrua-producao
```

### More Issues?

See [IAM_DEPLOYMENT_TROUBLESHOOTING.md](./IAM_DEPLOYMENT_TROUBLESHOOTING.md) for comprehensive troubleshooting.

## 📚 Additional Resources

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Tasks Documentation](https://cloud.google.com/tasks/docs)
- [IAM Best Practices](https://cloud.google.com/iam/docs/best-practices)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)

## 🤝 Contributing

When making changes:

1. Update relevant documentation
2. Test changes locally first
3. Use the verification checklist
4. Update this README if adding new scripts or documentation

## 📝 License

See the main application repository for license information.

---

**Last Updated**: February 2026  
**Project**: sisrua-producao  
**Maintainer**: See repository contributors
