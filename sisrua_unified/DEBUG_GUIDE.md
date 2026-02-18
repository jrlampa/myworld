# SIS RUA Unified - Debugging Guide

## Issue: CORS Errors on localhost + DXF Not Generated

### Root Cause
The error `Código de status: (null)` indicates the **backend is not running or not responding**, not a CORS misconfiguration.

### Quick Fix

#### 1. Run Backend and Frontend Simultaneously (Development)

**Terminal 1 - Backend:**
```bash
cd sisrua_unified
npm run server
# Should start on http://localhost:3001
```

**Terminal 2 - Frontend (Vite dev):**
```bash
cd sisrua_unified
npm run client
# Should start on http://localhost:3000 and auto-open browser
```

Both must run together for API calls to work.

#### 2. Verify Backend Health

```bash
curl -s http://localhost:3001/health | jq .
# Should return: { "status": "online", "service": "sisRUA Unified Backend", "version": "1.2.0" }
```

#### 3. Test DXF Endpoint Directly

```bash
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -23.566390,
    "lon": -46.656081,
    "radius": 100,
    "mode": "circle"
  }' | jq .
# Should return: { "status": "queued", "jobId": "..." }
```

If this fails, see **Backend Troubleshooting**.

#### 4. Monitor DXF Job Status

```bash
curl -s http://localhost:3001/api/jobs/{jobId} | jq .
# Should show: { "id": "...", "status": "queued|processing|completed", "progress": 0-100, "result": {...}, "error": null }
```

#### 5. Test Analyze Endpoint

```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"stats": {"buildings": 42}, "locationName": "Test Area"}' | jq .
# Should return analysis from Groq API
```

---

## Coordinate Test Case Provided

**Coordinates**: `-23.566390, -46.656081` (São Paulo, Brasil)  
**Radius**: 100m  
**Expected**: DXF file with OSM features (buildings, streets, etc.)

### Manual Test Steps

1. **Start both services** (Backend + Frontend as above)
2. **Open http://localhost:3000 in browser**
3. **Enter coordinates in map selector**: `23°33'58.6"S 46°39'22.9"W` (or search "São Paulo")
4. **Draw circle**: Radius ~100m  
5. **Click "Generate DXF"**
6. **Check browser console for errors** (F12 → Console tab)
7. **Monitor backend logs** in Terminal 1

---

## Backend Troubleshooting

### Issue: /health returns 500 or Connection Refused

**Solution**: 

1. Check Node.js is installed:
```bash
node --version  # Should be v22+
npm --version   # Should be v10+
```

2. Install dependencies:
```bash
cd sisrua_unified
npm ci --prefer-offline
```

3. Clear cache and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Python engine fails to spawn

**Check**:

1. Python is installed:
```bash
python3 --version  # Should be 3.9+
```

2. Python dependencies installed:
```bash
cd sisrua_unified
python3 -m pip install -r py_engine/requirements.txt
```

3. Test Python directly:
```bash
cd sisrua_unified
python3 py_engine/main.py --lat=-23.566390 --lon=-46.656081 --radius=100 --mode=circle --output=test.dxf
# Should create test.dxf in current directory
```

### Issue: Cloud Tasks queue misconfigured

**Check GCP configuration**:

```bash
gcloud tasks queues list --location=southamerica-east1 --project=sisrua-producao
# Should show: sisrua-queue

gcloud config get-value project
# Should be: sisrua-producao
```

---

## Frontend Troubleshooting

### Issue: Map doesn't load

**Solution**: Leaflet HTML is cached. Hard refresh:
- Windows/Linux: `Ctrl+Shift+Del` (clear cache) then `Ctrl+F5` (hard reload)
- Mac: `Cmd+Shift+Delete` then `Cmd+Shift+R`

### Issue: Recharts chart shows "The width(-1) and height(-1)..."

**Solution**: Chart container needs explicit dimensions. This is usually resolved by:
```typescript
<LineChart width={800} height={400}>
  {/* chart content */}
</LineChart>
```

Check `src/components/ElevationProfile.tsx` for dimension props.

---

## Environment Variables (Development)

Create `.env.development` in `sisrua_unified/`:

```bash
VITE_API_URL=http://localhost:3001
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GCP_PROJECT=sisrua-producao
CLOUD_RUN_BASE_URL=http://localhost:3001
```

(Get GROQ_API_KEY from GitHub repository secrets)

---

## Logging & Monitoring

### Backend Logs

Set log level:
```bash
LOG_LEVEL=debug npm run server
```

### Browser DevTools Console (F12)

Monitor:
- Network tab: Check request/response for `/api/*` calls
- Console tab: JavaScript errors
- Application tab: LocalStorage/SessionStorage state

---

## Common Issues Summary

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Código de status: (null)` | Backend not running | Start `npm run server` |
| `/health` returns 500 | Dependencies missing | Run `npm ci` |
| Python process hangs | Python deps missing | Run `pip install -r py_engine/requirements.txt` |
| DXF not generated | Cloud Tasks queue missing | Check GCP configuration |
| Map doesn't render | Leaflet cache | Hard refresh browser |
| Chart shows negative dimensions | Container needs width/height props | Check ElevationProfile.tsx |

---

## Next Steps

1. **Start both services** simultaneously
2. **Run the coordinate test** provided (`-23.566390, -46.656081`)
3. **Monitor Terminal 1 (backend)** for Python spawn errors
4. **Check Browser Console (F12)** for frontend errors
5. **Report any error messages** from steps 3-4
