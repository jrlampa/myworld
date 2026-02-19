# IAM and Deployment Verification Checklist

Use this checklist to verify that your Cloud Run deployment is correctly configured.

## 📋 Pre-Deployment Checklist

### Google Cloud Project Setup

- [ ] Project `sisrua-producao` exists
- [ ] You have Owner or Editor role on the project
- [ ] `gcloud` CLI installed and authenticated
- [ ] Docker installed (for local builds)

**Verify**:
```bash
gcloud config get-value project
gcloud auth list
```

### Required APIs Enabled

- [ ] Cloud Resource Manager API
- [ ] Cloud Tasks API
- [ ] Cloud Run API
- [ ] Cloud Build API
- [ ] Artifact Registry API

**Enable all**:
```bash
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  cloudtasks.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project=sisrua-producao
```

**Verify**:
```bash
gcloud services list --enabled --project=sisrua-producao | grep -E "(cloudtasks|run|cloudbuild)"
```

### Service Accounts

- [ ] Default Compute Engine service account exists
- [ ] Project number identified

**Verify**:
```bash
# Get project number
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
echo "Project Number: $PROJECT_NUMBER"

# Verify compute service account
gcloud iam service-accounts describe "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --project=sisrua-producao
```

Expected service account: `244319582382-compute@developer.gserviceaccount.com`

## 📋 IAM Permissions Checklist

### Cloud Tasks Enqueuer Permission

- [ ] `roles/cloudtasks.enqueuer` granted to compute service account

**Grant**:
```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

**Verify**:
```bash
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter='bindings.role=roles/cloudtasks.enqueuer' \
  --format="table(bindings.members)"
```

Expected output should include: `serviceAccount:244319582382-compute@developer.gserviceaccount.com`

### Cloud Run Invoker Permission

⚠️ **Note**: This can only be granted AFTER the Cloud Run service is deployed for the first time.

- [ ] Service `sisrua-app` deployed
- [ ] `roles/run.invoker` granted to compute service account

**Grant** (after deployment):
```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

**Verify**:
```bash
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --flatten="bindings[].members" \
  --filter='bindings.role=roles/run.invoker' \
  --format="table(bindings.members)"
```

Expected output should include:
- `allUsers` (if deployed with `--allow-unauthenticated`)
- `serviceAccount:244319582382-compute@developer.gserviceaccount.com`

## 📋 Cloud Tasks Queue Checklist

### Queue Creation

- [ ] Queue `sisrua-queue` created in `southamerica-east1`

**Create**:
```bash
gcloud tasks queues create sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=10
```

**Verify**:
```bash
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

Expected output should show:
- `name: projects/sisrua-producao/locations/southamerica-east1/queues/sisrua-queue`
- `state: RUNNING`

## 📋 Deployment Checklist

### Environment Variables

- [ ] `GROQ_API_KEY` configured (as GitHub secret or local env var)
- [ ] `GCP_PROJECT` = `sisrua-producao`
- [ ] `CLOUD_TASKS_LOCATION` = `southamerica-east1`
- [ ] `CLOUD_TASKS_QUEUE` = `sisrua-queue`
- [ ] `NODE_ENV` = `production`

### Initial Deployment

- [ ] Code is in `sisrua_unified` directory
- [ ] Dockerfile exists
- [ ] Container builds successfully

**Deploy**:
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
  --update-env-vars="GROQ_API_KEY=your-key,GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue,NODE_ENV=production" \
  --project=sisrua-producao
```

**Verify**:
```bash
# Check service status
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format='value(status.conditions[0].status)'
```

Expected output: `True`

### Service URL Update

- [ ] Service URL captured
- [ ] `CLOUD_RUN_BASE_URL` environment variable updated

**Update**:
```bash
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --update-env-vars="CLOUD_RUN_BASE_URL=${SERVICE_URL}" \
  --project=sisrua-producao
```

**Verify**:
```bash
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format='value(spec.template.spec.containers[0].env)'
```

Expected output should include: `CLOUD_RUN_BASE_URL=https://sisrua-app-...run.app`

## 📋 Post-Deployment Verification

### Health Check

- [ ] Health endpoint returns 200 OK

**Test**:
```bash
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

curl -I "${SERVICE_URL}/health"
```

Expected output:
```
HTTP/2 200
content-type: application/json
...
```

### Application Test

- [ ] Main application loads

**Test**:
```bash
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)

curl -s "${SERVICE_URL}/" | grep -i "sis rua"
```

Should return HTML containing "SIS RUA" or similar text.

### Cloud Tasks Integration

- [ ] Can create tasks
- [ ] Tasks execute successfully
- [ ] Webhooks receive OIDC tokens

**Manual test**: Use the application to generate a DXF file and check:

```bash
# Check if tasks are being created
gcloud tasks list \
  --queue=sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao

# Check Cloud Run logs for task execution
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=50 | grep -i "task\|dxf"
```

## 📋 GitHub Actions Checklist

If using automated deployment via GitHub Actions:

### Secrets Configuration

- [ ] `GCP_WIF_PROVIDER` configured
- [ ] `GCP_SERVICE_ACCOUNT` configured
- [ ] `GCP_PROJECT_ID` = `sisrua-producao`
- [ ] `GCP_PROJECT` = `sisrua-producao`
- [ ] `GROQ_API_KEY` configured

**Verify** in GitHub: Settings → Secrets and variables → Actions

### Workflow Permissions

- [ ] GitHub Actions service account has `roles/run.admin`
- [ ] GitHub Actions service account has `roles/iam.serviceAccountUser`
- [ ] Workload Identity Federation configured

**Verify**:
```bash
# Check service account permissions
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.members:github-actions@*"
```

### Workflow Test

- [ ] Workflow runs successfully on push to `main`
- [ ] Deployment completes without errors

**Test**: Push a commit to the `main` branch and monitor the workflow in GitHub Actions.

## 📋 Security Checklist

### IAM Best Practices

- [ ] Service accounts use principle of least privilege
- [ ] No service account keys committed to repository
- [ ] Workload Identity Federation used for CI/CD

### Application Security

- [ ] Rate limiting configured
- [ ] CORS configured appropriately
- [ ] Input validation enabled
- [ ] Secrets stored in Secret Manager or environment variables
- [ ] No hardcoded credentials in code

### Monitoring

- [ ] Cloud Run logs being collected
- [ ] Cloud Tasks queue monitored
- [ ] Error alerting configured (optional)

## 🔧 Automated Verification

Use the automated setup script:

```bash
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao
```

This script will:
- ✅ Verify project exists
- ✅ Find project number
- ✅ Verify service accounts exist
- ✅ Grant Cloud Tasks enqueuer role
- ✅ Grant Cloud Run invoker role (if service exists)
- ✅ Display verification results

## 📝 Troubleshooting

If any checks fail, see:
- [IAM_DEPLOYMENT_TROUBLESHOOTING.md](./IAM_DEPLOYMENT_TROUBLESHOOTING.md)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## ✅ Final Verification

All items in this checklist should be checked before considering the deployment complete:

### Critical Items

- [ ] Cloud Tasks enqueuer permission granted
- [ ] Cloud Run invoker permission granted (after deployment)
- [ ] Cloud Run service deployed and healthy
- [ ] Service URL configured in environment variables
- [ ] Health endpoint returns 200 OK
- [ ] DXF generation works end-to-end

### Optional but Recommended

- [ ] GitHub Actions deployment automated
- [ ] Monitoring and logging configured
- [ ] Error alerting set up
- [ ] Cost monitoring enabled
- [ ] Documentation updated

## 📊 Summary Report

After completing this checklist, generate a summary report:

```bash
echo "=== Deployment Verification Report ==="
echo ""
echo "Project: sisrua-producao"
echo "Date: $(date)"
echo ""
echo "Service Status:"
gcloud run services describe sisrua-app --region=southamerica-east1 --project=sisrua-producao --format='value(status.conditions[0].status)'
echo ""
echo "Service URL:"
gcloud run services describe sisrua-app --region=southamerica-east1 --project=sisrua-producao --format='value(status.url)'
echo ""
echo "IAM Permissions:"
echo "  Cloud Tasks Enqueuer:"
gcloud projects get-iam-policy sisrua-producao --flatten="bindings[].members" --filter='bindings.role=roles/cloudtasks.enqueuer' --format="value(bindings.members)" | grep compute
echo "  Cloud Run Invoker:"
gcloud run services get-iam-policy sisrua-app --region=southamerica-east1 --project=sisrua-producao --flatten="bindings[].members" --filter='bindings.role=roles/run.invoker' --format="value(bindings.members)" | grep compute
echo ""
echo "Queue Status:"
gcloud tasks queues describe sisrua-queue --location=southamerica-east1 --project=sisrua-producao --format='value(state)'
echo ""
echo "=== End of Report ==="
```

Save this output for your records.
