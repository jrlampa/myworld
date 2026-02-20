# DXF Generation Guide

This document covers DXF file generation in the SIS RUA application, including the GROQ AI integration and elevation profiles.

## Overview

SIS RUA converts OpenStreetMap (OSM) data into DXF files suitable for use in CAD applications (AutoCAD, LibreCAD, etc.).

### Architecture

```
User (browser) → POST /api/dxf
                      ↓
              Cloud Tasks Queue
                      ↓
         POST /api/tasks/process-dxf (webhook)
                      ↓
              Python Engine (py_engine/main.py)
                      ↓
              OSMnx → OSM data fetch
                      ↓
              ezdxf → DXF file generation
                      ↓
              File saved to /app/public/dxf/
                      ↓
         User downloads via /downloads/filename.dxf
```

## API Usage

### Generate DXF

```bash
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -22.15018,
    "lon": -42.92189,
    "radius": 2000,
    "mode": "circle",
    "projection": "local"
  }'
```

**Parameters:**
- `lat`: Latitude (decimal degrees, WGS84)
- `lon`: Longitude (decimal degrees, WGS84)
- `radius`: Radius in meters (for circle mode)
- `mode`: `"circle"` or `"polygon"`
- `polygon`: Array of coordinates (for polygon mode)
- `projection`: `"local"` or `"utm"` (UTM SIRGAS 2000 / UTM zone 23S)
- `layers`: Object specifying which layers to include

**Response:**
```json
{"status": "queued", "jobId": "uuid-here"}
```

### Check Job Status

```bash
curl http://localhost:3001/api/jobs/uuid-here
```

**Response:**
```json
{
  "id": "uuid-here",
  "status": "completed",
  "progress": 100,
  "result": {
    "url": "/downloads/dxf_1234567890.dxf",
    "filename": "dxf_1234567890.dxf"
  },
  "error": null
}
```

### Download DXF

```bash
curl -O http://localhost:3001/downloads/dxf_1234567890.dxf
```

## Direct Python Usage

```bash
# Generate DXF directly via Python engine
cd sisrua_unified
python3 py_engine/main.py \
  --lat -22.15018 \
  --lon -42.92189 \
  --radius 2000 \
  --output public/dxf/output.dxf \
  --selection-mode circle \
  --projection local
```

## UTM Coordinate Conversion

The application supports UTM coordinates (common in Brazilian CAD workflows):

**Example UTM coordinates (SIRGAS 2000):**
- Zone: 23K (Southern Hemisphere)
- Easting: 788512
- Northing: 7634958

**Converted to WGS84:**
- Latitude: -21.364501
- Longitude: -42.217942
- Location: Minas Gerais, Brazil

Use `--projection utm` when generating DXF for UTM-projected output.

## DXF File Structure

Generated DXF files contain:

**Layers:**
- `EDIFICACAO` — Buildings/structures
- `VIAS` — Roads and streets
- `VEGETACAO` — Vegetation
- `AGUA` — Water bodies
- `ILUMINACAO` — Street lighting
- `ENERGIA` — Power lines
- `AREA_ESTUDO` — Study area boundary
- `COTAS` — Dimensions
- `TEXTO` — Text annotations

**Format:** AutoCAD Drawing Exchange Format (DXF), version 2018

## File Cleanup

DXF files are automatically deleted **10 minutes** after creation (business requirement). The cleanup service:
- Schedules deletion 10 minutes after file creation
- Runs periodic cleanup check every 2 minutes
- Logs all cleanup operations

## GROQ AI Analysis

After generating DXF data, SIS RUA provides AI-powered analysis using GROQ's LLaMA model.

### Configuration

```bash
GROQ_API_KEY=gsk_your_key_here
```

Get your free key at: https://console.groq.com/keys

### Test Analysis

```bash
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "stats": {
      "buildings": 42,
      "roads": 15,
      "area": 2000
    },
    "locationName": "Test Area"
  }'
```

### Error Messages

When GROQ is not configured, users see a helpful Portuguese message:

```markdown
**Análise AI Indisponível**

Para habilitar análises inteligentes com IA, configure a variável 
`GROQ_API_KEY` no arquivo `.env`.

Obtenha sua chave gratuita em: https://console.groq.com/keys
```

## Elevation Service

The application fetches elevation profiles using the Open-Elevation API (free, no API key required).

### Features
- 10-second timeout for API calls
- Automatic fallback to flat terrain (sea level) if API fails
- Comprehensive error logging

### Alternative Services

| Service | Cost | Notes |
|---------|------|-------|
| Open-Elevation | Free | Current, no API key |
| Google Elevation | Paid (after quota) | More reliable |
| Mapbox Elevation | Paid | High performance |

**Recommendation**: Keep Open-Elevation for development/alpha. Consider paid alternatives if reliability issues arise in production.

### Test Elevation

```bash
curl -X POST http://localhost:3001/api/elevation/profile \
  -H "Content-Type: application/json" \
  -d '{
    "start": {"lat": -22.15018, "lng": -42.92189},
    "end": {"lat": -22.16, "lng": -42.93}
  }'
```

## Viewers for DXF Files

- **AutoCAD** (recommended)
- **DraftSight** (free)
- **LibreCAD** (open source)
- **QCAD** (open source)
- Online DXF viewers (browser-based)
