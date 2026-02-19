# DXF Troubleshooting

This document covers common DXF generation errors and their solutions.

## Error: "DXF file was not created at expected path"

**Symptom:**
```
DXF Error: DXF file was not created at expected path: /app/public/dxf/dxf_1234567890.dxf
```

**Cause:** The Python DXF generator was attempting to save files without first ensuring the output directory exists.

**Fix Applied:** Added defensive directory creation in `py_engine/dxf_generator.py`:
```python
# Ensure output directory exists before saving
output_dir = os.path.dirname(self.filename)
if output_dir and output_dir != '.':
    os.makedirs(output_dir, exist_ok=True)
```

**Manual Fix (if still occurs):**
```bash
mkdir -p /app/public/dxf
```

## Error: "Backend generation failed" (JSON.parse Error)

**Symptom:**
```
DXF Error: JSON.parse: unexpected character at line 1 column 1 of the JSON data
```

**Cause:** Missing `return` statements in the Express API handler caused multiple responses to be sent. The second response overwrites the JSON with an HTML error page.

**Fix Applied:** All `res.status().json()` calls now have `return` to prevent execution continuing after response.

## Error: "Cloud Tasks queue not found" (NOT_FOUND)

**Symptom:**
```
DXF Error: Cloud Tasks queue 'sisrua-queue' not found in project 'sisrua-producao'
```

**Cause:** Despite the queue existing, the service account lacks permission to access it. Google returns `NOT_FOUND` instead of `PERMISSION_DENIED` for security.

**Fix:** Grant `roles/cloudtasks.enqueuer` to the Cloud Run service account.
See [Cloud Tasks documentation](../cloud/cloud-tasks.md#service-account-permissions).

## Error: "Could not contact analysis backend" (GROQ)

**Symptom:** Generic error when GROQ API is not configured.

**Fix Applied:** Backend now returns a specific 503 with instructions:
```
**Análise AI Indisponível**
Configure GROQ_API_KEY para habilitar análises.
Obtenha sua chave em: https://console.groq.com/keys
```

## Error: "Not allowed by CORS"

**Symptom:**
```
Error: Not allowed by CORS
Endpoint: /api/dxf
Status: HTTP 500
```

**Cause:** Cloud Run service rejecting requests from itself (CORS misconfiguration).

**Fix Applied:** The CORS middleware now detects and allows Cloud Run origins:
```typescript
const isCloudRunOrigin = origin && origin.includes('.run.app');
```

See [Cloud Run CORS documentation](../cloud/cloud-run.md#cors-fix-critical).

## Error: Python Dependencies Not Found

**Symptom:**
```
ModuleNotFoundError: No module named 'osmnx'
```

**In Docker builds:**
```
Exit code: 1
Failing at: Dockerfile:75
```

**Cause:** The Python verification step was using system Python instead of the venv Python.

**Fix Applied:**
```dockerfile
# Use explicit venv path
RUN /opt/venv/bin/python3 -c "import osmnx, ezdxf, geopandas; print('OK')"
```

Also removed premature `apt-get purge build-essential` that was breaking native extension compilation.

**Manual Fix (local development):**
```bash
cd sisrua_unified
pip3 install -r py_engine/requirements.txt

# Verify:
python3 -c "import osmnx, ezdxf, geopandas; print('All OK')"
```

## Error: OSM API Unreachable

**Symptom:** DXF generation times out or fails with network error.

**Cause:** The Overpass API (overpass-api.de) is unreachable or slow.

**Verification:**
```bash
curl https://overpass-api.de/api/status
```

**Workarounds:**
- Try again later (API may be temporarily busy)
- Use a smaller radius (< 500m)
- Use a different Overpass endpoint if available

## Diagnosis Script

Run the automated diagnosis tool to identify issues:

```bash
cd sisrua_unified
chmod +x diagnose_dxf.sh
./diagnose_dxf.sh
```

The script checks:
- ✓ Python availability and version
- ✓ Python dependency installation
- ✓ OSM API connectivity
- ✓ Node.js environment
- ✓ Directory structure
- ✓ Python engine execution

## Common Diagnosis Results

```
✓ Python 3.12.3 installed
✓ All Python dependencies installed (osmnx, ezdxf, geopandas)
✓ Node.js working
✓ Directory structure correct
✓ Python engine executable
✗ OSM Overpass API unreachable  ← Most common issue in restricted environments
```

## Debug Mode

Enable detailed logging in the backend:

```bash
LOG_LEVEL=debug npm run server
```

Check the health endpoint for system status:

```bash
curl http://localhost:3001/health | jq
```

Expected:
```json
{
  "status": "online",
  "python": "available",
  "environment": "development"
}
```

## Production Debugging (Cloud Run)

```bash
# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=sisrua-app" \
  --limit 50 --format json | jq '.[] | .jsonPayload'

# Filter for DXF errors
gcloud logging read "resource.labels.service_name=sisrua-app AND \
  jsonPayload.message:(\"DXF\" OR \"dxf\" OR \"Python\")" \
  --limit 20
```

## Investigation Findings

A detailed comparison between a known-working commit and the current HEAD revealed:

**The current code is BETTER than older versions.** All changes were improvements:
- Added `projection` parameter support (new feature)
- Added `layers` parameter in dev mode (bug fix)
- Added `return` statements (fixes double-response bug)
- Better error handling with global handler
- Improved input validation with Zod
- Enhanced CORS and health check
- More complete logging

The most common cause of DXF failures is **OSM API connectivity**, not code bugs.
