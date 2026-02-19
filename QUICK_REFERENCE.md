# Quick Reference Card - Cloud Run Deployment

## 🚀 Essential Commands

### Initial Setup (One-Time)
```bash
# Setup IAM permissions automatically
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao
```

### Deploy Application
```bash
# Navigate to app directory
cd sisrua_unified

# Deploy from source (recommended)
gcloud run deploy sisrua-app \
  --source=. \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Update Service URL
```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

# Update environment variable
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --update-env-vars="CLOUD_RUN_BASE_URL=${SERVICE_URL}" \
  --project=sisrua-producao
```

## 🔍 Verification

### Check Service Status
```bash
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Test Health Endpoint
```bash
curl $(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)/health
```

### View Logs
```bash
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=50
```

## 🔐 IAM Permissions

### Find Project Number
```bash
gcloud projects describe sisrua-producao --format="value(projectNumber)"
# Output: 244319582382
```

### Service Account Format
```
Compute: 244319582382-compute@developer.gserviceaccount.com
App Engine: sisrua-producao@appspot.gserviceaccount.com
```

### Grant Cloud Tasks Enqueuer
```bash
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

### Grant Cloud Run Invoker
```bash
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:244319582382-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

### Verify Permissions
```bash
# Cloud Tasks
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter='bindings.role=roles/cloudtasks.enqueuer'

# Cloud Run
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --filter='bindings.role=roles/run.invoker'
```

## 📊 Monitoring

### Queue Status
```bash
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

### List Tasks
```bash
gcloud tasks list \
  --queue=sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

### Service Metrics
```bash
# List revisions
gcloud run revisions list \
  --service=sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao

# Service details
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

## 🚨 Troubleshooting

### Permission Denied
```bash
# Re-run IAM setup
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao
```

### Image Not Found
```bash
# Use --source instead of --image
cd sisrua_unified
gcloud run deploy sisrua-app --source=. --region=southamerica-east1 --project=sisrua-producao
```

### Service Logs
```bash
# Recent logs
gcloud run services logs read sisrua-app --region=southamerica-east1 --project=sisrua-producao --limit=50

# Follow logs
gcloud run services logs tail sisrua-app --region=southamerica-east1 --project=sisrua-producao
```

## 📚 Full Documentation

- **Complete Guide**: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Troubleshooting**: [IAM_DEPLOYMENT_TROUBLESHOOTING.md](./IAM_DEPLOYMENT_TROUBLESHOOTING.md)
- **Checklist**: [DEPLOYMENT_VERIFICATION_CHECKLIST.md](./DEPLOYMENT_VERIFICATION_CHECKLIST.md)
- **Main README**: [README.md](./README.md)

## ⚡ Quick Deploy Sequence

```bash
# 1. Setup IAM (one-time)
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao

# 2. Deploy
cd sisrua_unified
gcloud run deploy sisrua-app --source=. --region=southamerica-east1 --project=sisrua-producao

# 3. Update URL
SERVICE_URL=$(gcloud run services describe sisrua-app --region=southamerica-east1 --format='value(status.url)' --project=sisrua-producao)
gcloud run services update sisrua-app --region=southamerica-east1 --update-env-vars="CLOUD_RUN_BASE_URL=${SERVICE_URL}" --project=sisrua-producao

# 4. Grant invoker (if needed)
cd ..
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao

# 5. Test
curl $(gcloud run services describe sisrua-app --region=southamerica-east1 --format='value(status.url)' --project=sisrua-producao)/health
```

## 📝 Environment Variables

Required for deployment:
```
GROQ_API_KEY=your-groq-api-key
GCP_PROJECT=sisrua-producao
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=sisrua-queue
NODE_ENV=production
CLOUD_RUN_BASE_URL=https://sisrua-app-...run.app
```

Set during deployment with:
```bash
--update-env-vars="KEY=value,KEY2=value2"
```

---

**Project**: sisrua-producao  
**Region**: southamerica-east1  
**Service**: sisrua-app  
**Queue**: sisrua-queue
