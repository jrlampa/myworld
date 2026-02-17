# Cloud Run Deployment Fixes - Summary

## Critical Issues Resolved

### 1. Python Script Path Error ✅
**Error**: `DXF Error: Python script failed with code 2 - can't open file '/app/server/py_engine/main.py'`

**Root Cause**: 
- Docker copies py_engine to `/app/py_engine`
- Server runs from `/app/server/dist/server/index.js`
- pythonBridge.ts used relative path `../../py_engine/main.py` which resolved to wrong location

**Fix Applied**:
- Production: Use absolute path `/app/py_engine/main.py`
- Development: Use relative path `../../py_engine/main.py`
- Use `python3` command in production (Ubuntu container)

### 2. Open-Meteo API 400 Errors ✅
**Error**: `400 da API do Open-Meteo`

**Root Cause**:
- Batch size of 100 coordinates created URLs exceeding length limits
- No URL encoding for comma-separated values

**Fix Applied**:
- Reduced batch size from 100 to 30 in both TypeScript and Python
- Added URL encoding in TypeScript service
- Enhanced error messages to show API response details
- Python already uses requests.get with params (auto-encodes)

### 3. /analyze Endpoint 500 Errors ✅
**Error**: `erro 500 da rota /analyze`

**Root Cause**:
- Endpoint returned only elevation data when coordinates provided
- Missing AI analysis integration
- No validation for missing parameters

**Fix Applied**:
- Support combinations: coordinates only, stats only, or both
- Chain elevation fetch with AI analysis when both provided
- Added proper type validation with Zod schemas
- Return 400 for missing required parameters

### 4. Path Resolution Issues ✅
**Problem**: Static files and DXF outputs not accessible in production

**Fix Applied**:
- Created path resolution for public directory (like frontend dist)
- Auto-create DXF output directory if missing
- Updated all file operations to use resolved paths
- Added .dockerignore for optimized builds

### 5. Missing Dependencies ✅
**Problem**: Python elevation client missing requests library

**Fix Applied**:
- Added requests>=2.31.0 to requirements.txt
- Removed redundant numpy (included by geopandas)

## Deployment Structure

```
/app/
├── py_engine/              # Python scripts
│   └── main.py            # Absolute path: /app/py_engine/main.py
├── public/                # Static files
│   └── dxf/              # DXF outputs
├── dist/                  # Frontend build
│   └── index.html
└── server/
    └── dist/             # Compiled server
        └── server/
            └── index.js  # Entry point
```

## Environment Variables Required

- `NODE_ENV=production` (set in Dockerfile)
- `PORT=8080` (set in Dockerfile)
- `GROQ_API_KEY` (set via gcloud deploy command)

## Testing Checklist

- [ ] Docker build succeeds
- [ ] Container starts without errors
- [ ] Python script can be executed
- [ ] DXF generation works
- [ ] Open-Meteo elevation fetching works (small batches)
- [ ] /api/analyze endpoint returns 200 for valid requests
- [ ] Static files served correctly
- [ ] Health check endpoint responds

## Deployment Command

```bash
gcloud run deploy <SERVICE_NAME> \
  --project=<PROJECT_ID> \
  --region=<REGION> \
  --source=. \
  --allow-unauthenticated \
  --set-env-vars="GROQ_API_KEY=<YOUR_KEY>"
```

## Rollback Plan

If issues persist:
1. Check Cloud Run logs for specific errors
2. Verify environment variables are set
3. Check file permissions in container
4. Validate Python dependencies installation
5. Test locally with Docker: `docker build -t sisrua . && docker run -p 8080:8080 sisrua`
