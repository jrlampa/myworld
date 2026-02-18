# Troubleshooting Cloud Tasks Issues

## Common Issues and Solutions

### Issue: "5 NOT_FOUND: Requested entity was not found"

**Symptoms:**
- DXF generation returns HTTP 500 error
- Logs show "Failed to create Cloud Task"
- Error message: "5 NOT_FOUND: Requested entity was not found"

**Root Cause:**
The Cloud Tasks queue (`sisrua-queue`) does not exist in the specified GCP project and location.

**Solution:**

#### Option 1: Run the Setup Script (Recommended)
```bash
cd sisrua_unified
./scripts/setup-cloud-tasks-queue.sh
```

#### Option 2: Create Queue Manually
```bash
gcloud tasks queues create sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=10
```

#### Option 3: Wait for Next Deployment
The queue will be automatically created during the next deployment via GitHub Actions.

**Verification:**
```bash
# Check if queue exists
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao

# List all queues
gcloud tasks queues list \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

---

### Issue: "Permission Denied" when Creating Tasks

**Symptoms:**
- Error: "Permission 'cloudtasks.tasks.create' denied"
- DXF generation fails with 500 error

**Root Cause:**
The Cloud Run service account lacks the necessary permissions to create tasks.

**Solution:**
Grant the Cloud Tasks Enqueuer role to the service account:

```bash
# Get the service account email
SERVICE_ACCOUNT="${GCP_PROJECT}@appspot.gserviceaccount.com"

# Grant Cloud Tasks Enqueuer role
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudtasks.enqueuer"
```

---

### Issue: "OIDC Authentication Failed" for Webhook

**Symptoms:**
- Tasks are created but webhook fails
- Error: "Unauthorized" or "OIDC token validation failed"

**Root Cause:**
The service account doesn't have permission to invoke the Cloud Run service.

**Solution:**
Grant the Cloud Run Invoker role:

```bash
SERVICE_ACCOUNT="${GCP_PROJECT}@appspot.gserviceaccount.com"

gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker"
```

---

### Issue: Environment Variables Not Set

**Symptoms:**
- Application can't find queue configuration
- Logs show "not-set" for GCP_PROJECT or queue variables

**Root Cause:**
Environment variables are not properly configured in Cloud Run.

**Solution:**
Update environment variables in Cloud Run:

```bash
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --update-env-vars="GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue"
```

**Verification:**
```bash
# Check current environment variables
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format="value(spec.template.spec.containers[0].env)"
```

---

### Issue: Development Mode Not Working

**Symptoms:**
- Tasks are being created even in local development
- Or: Tasks are not being created when they should be

**Root Cause:**
The `GCP_PROJECT` environment variable determines the mode. If set, the app runs in production mode and tries to use Cloud Tasks.

**Solution for Local Development:**
1. Don't set `GCP_PROJECT` in your local `.env` file
2. Or set `NODE_ENV=development`

**In Local .env:**
```bash
# For local development - do NOT set GCP_PROJECT
NODE_ENV=development
PORT=8080
GROQ_API_KEY=your-key-here
# GCP_PROJECT=   <-- Leave commented out for local dev
```

**Verification:**
Check logs for:
- Development mode: "Development mode: Generating DXF directly (no Cloud Tasks)"
- Production mode: "Creating Cloud Task for DXF generation"

---

## Monitoring and Debugging

### Check Cloud Run Logs
```bash
# Real-time logs
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=50

# Filter for DXF-related errors
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=sisrua-app AND textPayload:'DXF'" \
  --project=sisrua-producao \
  --limit=50 \
  --format=json
```

### Check Cloud Tasks Queue Status
```bash
# Queue statistics
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao

# List tasks in queue
gcloud tasks list \
  --queue=sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

### Test DXF Generation Locally
```bash
# Start the server
npm run dev

# In another terminal, test the endpoint
curl -X POST http://localhost:8080/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -22.809100,
    "lon": -43.360432,
    "radius": 2000,
    "mode": "circle"
  }'
```

---

## Complete Setup Checklist

Use this checklist to ensure everything is configured correctly:

- [ ] Cloud Tasks queue exists in GCP
  ```bash
  gcloud tasks queues describe sisrua-queue --location=southamerica-east1
  ```

- [ ] Service account has Cloud Tasks Enqueuer role
  ```bash
  gcloud projects get-iam-policy sisrua-producao --flatten="bindings[].members" --filter="bindings.role:roles/cloudtasks.enqueuer"
  ```

- [ ] Service account has Cloud Run Invoker role
  ```bash
  gcloud run services get-iam-policy sisrua-app --region=southamerica-east1
  ```

- [ ] Environment variables are set in Cloud Run
  ```bash
  gcloud run services describe sisrua-app --region=southamerica-east1 --format="value(spec.template.spec.containers[0].env)"
  ```

- [ ] Application is deployed and running
  ```bash
  gcloud run services describe sisrua-app --region=southamerica-east1 --format="value(status.url,status.conditions)"
  ```

---

## Quick Reference

### Environment Variables Required
```bash
GCP_PROJECT=sisrua-producao
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=sisrua-queue
CLOUD_RUN_BASE_URL=https://your-app.run.app
NODE_ENV=production
```

### Required GCP Roles
- `roles/cloudtasks.enqueuer` - To create tasks
- `roles/run.invoker` - To call the webhook

### Useful Commands
```bash
# Create queue
./scripts/setup-cloud-tasks-queue.sh

# Check queue
gcloud tasks queues describe sisrua-queue --location=southamerica-east1

# View logs
gcloud run services logs read sisrua-app --region=southamerica-east1 --limit=50

# Update env vars
gcloud run services update sisrua-app --region=southamerica-east1 --update-env-vars="KEY=VALUE"
```

---

## Support

If you continue to experience issues:

1. Check the logs using the commands above
2. Verify all prerequisites are met
3. Review the [CLOUD_TASKS_TEST_GUIDE.md](./CLOUD_TASKS_TEST_GUIDE.md) for testing procedures
4. Contact the development team with:
   - Error messages from logs
   - Output of verification commands
   - Steps taken to resolve the issue
