# Cloud Tasks Migration Test Guide

## Testing DXF Generation with UTM Coordinates

### Test Coordinates
- **Original**: UTM Zone 23K - 668277 E, 7476679 N
- **Converted**: Lat -22.809100, Lon -43.360432
- **Radius**: 2000 meters (2km)

### Prerequisites

1. **Cloud Tasks Queue Setup** (Automated or Manual):
   
   **Option A - Automated (Recommended)**: The queue is automatically created during deployment by the GitHub Actions workflow.
   
   **Option B - Manual Setup**: Run the setup script:
   ```bash
   cd sisrua_unified
   ./scripts/setup-cloud-tasks-queue.sh
   ```
   
   **Option C - Using gcloud directly**:
   ```bash
   gcloud tasks queues create sisrua-queue \
     --location=southamerica-east1 \
     --project=sisrua-producao \
     --max-dispatches-per-second=10 \
     --max-concurrent-dispatches=10
   ```

2. **Environment Variables** (in Cloud Run or .env):
   ```bash
   GCP_PROJECT=sisrua-producao
   CLOUD_TASKS_LOCATION=southamerica-east1
   CLOUD_TASKS_QUEUE=sisrua-queue
   CLOUD_RUN_BASE_URL=https://your-cloud-run-url.run.app
   ```

3. **Service Account Permissions**:
   - Cloud Tasks Enqueuer
   - Cloud Run Invoker (for webhook OIDC)

## Testing Methods

### Method 1: Via API Endpoint (Recommended)

```bash
# Start the server
npm run dev

# In another terminal, make a request
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -22.809100,
    "lon": -43.360432,
    "radius": 2000,
    "mode": "circle",
    "projection": "utm"
  }'

# Response will include a jobId
# {"status":"queued","jobId":"abc-123-def"}

# Check job status
curl http://localhost:3001/api/jobs/abc-123-def
```

### Method 2: Direct Webhook Test (Development)

```bash
# Simulate what Cloud Tasks would do
curl -X POST http://localhost:3001/api/tasks/process-dxf \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "test-123",
    "lat": -22.809100,
    "lon": -43.360432,
    "radius": 2000,
    "mode": "circle",
    "polygon": "[]",
    "layers": {},
    "projection": "utm",
    "outputFile": "./public/dxf/test_utm.dxf",
    "filename": "test_utm.dxf",
    "cacheKey": "test-cache",
    "downloadUrl": "http://localhost:3001/downloads/test_utm.dxf"
  }'
```

### Method 3: Python Script (Bypass Queue)

```bash
cd sisrua_unified
python3 generate_dxf.py \
  --lat -22.809100 \
  --lon -43.360432 \
  --radius 2000 \
  --output public/dxf/utm_23k_test.dxf \
  --projection utm \
  --client "Test Client" \
  --project "UTM Zone 23K - 2km radius" \
  --verbose
```

## Verification

### 1. Check Job Status
```bash
# Query the job status endpoint
curl http://localhost:3001/api/jobs/<job-id>

# Expected responses:
# {"id":"...","status":"queued","progress":0}
# {"id":"...","status":"processing","progress":10}
# {"id":"...","status":"completed","progress":100,"result":{"url":"...","filename":"..."}}
```

### 2. Check Cloud Tasks Queue (Production)
```bash
gcloud tasks list \
  --queue=sisrua-queue \
  --location=southamerica-east1
```

### 3. Check Generated DXF
```bash
ls -lh public/dxf/
# Should see the generated .dxf file

# Verify DXF file
python3 -c "
import ezdxf
doc = ezdxf.readfile('public/dxf/utm_23k_test.dxf')
print(f'DXF Version: {doc.dxfversion}')
print(f'Layers: {len(doc.layers)}')
print(f'Entities: {sum(1 for _ in doc.modelspace())}')
"
```

### 4. Check Logs
```bash
# Local development
# Check console output for:
# - "Creating Cloud Task for DXF generation"
# - "Cloud Task created successfully"
# - "DXF task webhook called"
# - "Processing DXF generation task"
# - "DXF generation completed"

# Production (Cloud Run)
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --limit=50
```

## Expected Flow

1. **Request** → POST `/api/dxf`
   - Validates input
   - Checks cache
   - Creates Cloud Task
   - Creates job status entry
   - Returns `{status: "queued", jobId: "..."}`

2. **Cloud Tasks** (after ~1-5 seconds)
   - Dispatches HTTP POST to `/api/tasks/process-dxf`
   - Includes OIDC token in Authorization header
   - Payload contains all DXF parameters

3. **Webhook** → `/api/tasks/process-dxf`
   - Verifies OIDC token (production)
   - Updates job status: "processing"
   - Calls Python bridge
   - Python generates DXF file
   - Updates cache
   - Updates job status: "completed"
   - Returns success

4. **Client Polling** → GET `/api/jobs/:id`
   - Client polls every 2-3 seconds
   - When status = "completed", gets download URL
   - Downloads DXF from `/downloads/:filename`

## Troubleshooting

### Issue: "Cloud Task creation failed"
**Solution**: Check GCP project permissions and queue exists
```bash
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1
```

### Issue: "Job not found"
**Solution**: Jobs expire after 1 hour. Check timing or increase TTL in `jobStatusService.ts`

### Issue: "Python script failed"
**Solution**: Check Python dependencies are installed:
```bash
pip install -r py_engine/requirements.txt
```

### Issue: "OIDC authentication failed"
**Solution**: Ensure service account has Cloud Run Invoker role:
```bash
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${GCP_PROJECT}@appspot.gserviceaccount.com" \
  --role="roles/run.invoker"
```

## Performance Notes

- **Local Development**: Tasks execute immediately via direct HTTP
- **Production**: Cloud Tasks adds ~1-5 second delay (acceptable for async processing)
- **Timeout**: Webhook has 60 second timeout (configurable)
- **Concurrency**: Cloud Tasks handles automatic retry and rate limiting

## Migration Checklist

- [x] Remove Redis/Bull dependencies
- [x] Install @google-cloud/tasks
- [x] Create cloudTasksService.ts
- [x] Create jobStatusService.ts
- [x] Add webhook endpoint
- [x] Update /api/dxf endpoint
- [x] Update /api/batch/dxf endpoint
- [x] Update /api/jobs/:id endpoint
- [ ] Test with UTM coordinates: 23k 668277 7476679 (2km radius)
- [ ] Deploy to Cloud Run
- [ ] Verify Cloud Tasks queue exists
- [ ] Monitor logs and metrics

## Success Criteria

✅ DXF file generated successfully
✅ Job status updates correctly (queued → processing → completed)
✅ Cloud Tasks queue shows tasks being created and processed
✅ No Redis dependencies in package.json
✅ Webhook receives OIDC-authenticated requests
✅ Files are cached correctly
✅ Download URL works

---

**Test Coordinates Reference**:
- UTM Zone 23K: 668277 E, 7476679 N
- Lat/Lon: -22.809100, -43.360432
- Location: Rio de Janeiro area, Brazil
- Radius: 2000m (2km)
