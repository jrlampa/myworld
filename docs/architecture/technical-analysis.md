# Technical Architecture

This document describes the architecture of the SIS RUA Unified application, combining technical analysis from multiple sources.

## System Overview

**SIS RUA Unified** is a web application that converts OpenStreetMap (OSM) data into DXF files for use in CAD applications.

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript + Vite + TailwindCSS | React 19.2.4 |
| Backend | Node.js + Express.js + TypeScript | Node.js 22 |
| Python Engine | Python + OSMnx + ezdxf + GeoPandas | Python 3.12 |
| Infrastructure | Google Cloud Run + Cloud Tasks | — |
| AI Analysis | GROQ LLaMA 3.3 70B | — |
| Geocoding | OpenStreetMap Nominatim + Photon | — |
| Elevation | Open-Elevation API | — |

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (React)                    │
│  MapSelector | Dashboard | ElevationProfile | BatchUpload│
│  FloatingLayerPanel | SettingsModal | ProgressIndicator  │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP API
                        ▼
┌─────────────────────────────────────────────────────────┐
│               Backend (Node.js/Express)                  │
│                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │  cloudTasks  │  │  jobStatus    │  │    cache    │  │
│  │  Service.ts  │  │  Service.ts   │  │  Service.ts │  │
│  └──────┬───────┘  └───────────────┘  └─────────────┘  │
│         │                                               │
│  ┌──────▼───────────────────────────────────────────┐  │
│  │              server/index.ts (Express)           │  │
│  │  /api/dxf | /api/jobs | /api/search | /health   │  │
│  │  /api/analyze | /api/elevation | /api/tasks      │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ spawn()
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Python Engine (py_engine/)                  │
│                                                         │
│  main.py → OSMnx (fetch OSM data) → dxf_generator.py  │
│         → ezdxf (create DXF file)                      │
│         → GeoPandas (spatial analysis)                 │
└─────────────────────────────────────────────────────────┘
```

## Task Processing

### Asynchronous DXF Generation Flow

```
1. User Request → POST /api/dxf
2. Backend creates Cloud Task → returns { jobId }
3. Cloud Tasks Queue holds the task
4. Cloud Tasks invokes webhook → POST /api/tasks/process-dxf
5. Webhook spawns Python engine
6. Python fetches OSM data and generates DXF
7. Job status updated → completed
8. User polls GET /api/jobs/:id → downloads DXF
```

**Why Cloud Tasks?** Serverless-native, no Redis needed, managed reliability, built-in OIDC auth.

## Frontend Architecture

### Component Tree

```
App.tsx
├── ErrorBoundary
├── MapSelector (interactive map)
├── Dashboard (statistics)
├── ElevationProfile (charts)
├── FloatingLayerPanel (layer controls)
├── SettingsModal (configuration)
├── BatchUpload (CSV processing)
├── ProgressIndicator (job tracking)
├── Toast (notifications)
├── HistoryControls (undo/redo)
└── DxfLegend (layer info)
```

### Custom Hooks

| Hook | Responsibility |
|------|---------------|
| `useFileOperations` | Project save/load |
| `useSearch` | Location search |
| `useDxfExport` | DXF download |
| `useKmlImport` | KML file import |
| `useElevationProfile` | Elevation profile management |
| `useOsmEngine` | OSM data fetching |
| `useUndoRedo` | Undo/redo history |

### State Management

No external state library — uses React hooks and context. Custom hooks provide separation of concerns.

## Backend Services

| Service | File | Purpose |
|---------|------|---------|
| Cloud Tasks | `cloudTasksService.ts` | DXF job queue management |
| Job Status | `jobStatusService.ts` | In-memory job tracking |
| Cache | `cacheService.ts` | DXF metadata cache |
| DXF Cleanup | `dxfCleanupService.ts` | Auto-delete DXF files after 10 minutes |
| Python Bridge | `pythonBridge.ts` | Spawn Python engine |

## Python Engine

### Data Pipeline

```
OSMnx → Fetch OSM graph and features
      ↓
GeoPandas → Spatial processing
      ↓
dxf_generator.py → Layer creation
      ↓
ezdxf → DXF file writing
```

### Layer Naming Convention

```
sisRUA_EDIFICACAO   → Buildings
sisRUA_VIAS         → Roads
sisRUA_VEGETACAO    → Vegetation
sisRUA_AGUA         → Water bodies
sisRUA_ILUMINACAO   → Street lighting
sisRUA_ENERGIA      → Power lines
sisRUA_AREA_ESTUDO  → Study boundary
sisRUA_COTAS        → Dimensions
sisRUA_TEXTO        → Text/labels
```

### Constants

Key values from `py_engine/constants.py`:

```python
POWER_LINE_BUFFER_METERS = 5.0
STREET_LAMP_COVERAGE_METERS = 15.0
IDEAL_LAMP_SPACING_METERS = 30.0
DEFAULT_TEXT_HEIGHT = 2.5
MIN_LINE_LENGTH_FOR_LABEL = 0.1
```

## Implementation Phases

### Phase 1: Core Security Fixes (Complete)
- OIDC webhook authentication
- API key exposure removal
- Dependency vulnerability assessment

### Phase 2: API Hardening (Complete)
- Body size limits (50MB → 1MB)
- Zod input validation on all endpoints
- Rate limiting on webhook

### Phase 3: Persistent Storage (Complete)
- Firestore for job status and DXF cache metadata
- Circuit breaker at 95% quota
- Auto-cleanup at 80% storage

### Phase 4: Future (Planned)
- Cloud Storage for large DXF files
- Multi-instance job tracking
- CDN for static assets
- User authentication

## Known Limitations

| Limitation | Impact | Planned Fix |
|------------|--------|-------------|
| Job status in-memory | Lost on restart | Firestore (Phase 3) |
| DXF files on local filesystem | Not shared across instances | Cloud Storage (Phase 4) |
| OSM API dependency | Fails without internet | Cache / offline mode |
| Single-region | Latency for non-SA users | Multi-region (future) |

## Performance

### Build Output

- Frontend bundle: ~1.1MB (optimized with Vite code splitting)
  - Main app: 55KB
  - React vendor: 217KB
  - Leaflet: 149KB
  - UI libraries: 253KB
- Backend TypeScript → compiled to `dist/`
- Python venv: ~200MB (built in Docker, not committed)

### Cloud Run Limits

| Resource | Limit | Notes |
|----------|-------|-------|
| Memory | 1024Mi | Monitor for OOM |
| CPU | 2 vCPU | Per instance |
| Request timeout | 300s | DXF may take 1-3 min |
| File upload | 5MB | CSV batch uploads |
| Max instances | 10 | Auto-scaling |
