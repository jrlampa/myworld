# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-21

### Maturity Assessment — Why 1.0.0

Analysis of the project's actual state determined that `0.1.0` (pre-stable, API unstable) did not
reflect its real maturity. The project qualifies as a **stable 1.0.0** release based on:

| Criterion | Evidence |
|---|---|
| **Production deployment** | Google Cloud Run with 7 GitHub Actions CI/CD workflows |
| **Stable API** | Swagger/OpenAPI documented REST API with Zod validation on all endpoints |
| **Enterprise features** | Firestore (circuit breaker), Cloud Tasks (async), rate limiting, OIDC auth |
| **Comprehensive tests** | 207 backend tests (~97.94% coverage), 110 Python tests, Playwright E2E (350 lines) |
| **Complete full-stack** | React 19 + TypeScript frontend, Express backend, Python DXF engine |
| **18,333+ lines** | 145 source files across 3 languages |
| **ABNT compliance** | DXF output compliant with NBR 8196/10582/13142 |
| **Brazilian gov APIs** | IBGE, DNIT, INCRA integrated |

> `0.1.0` per SemVer signals "initial development — API may change at any time".  
> A production-deployed, enterprise-grade, feature-complete platform is `1.0.0` by definition.

### Changed

- **Version corrected**: `0.1.0` → `1.0.0` to reflect actual project maturity

## [0.1.0] - 2026-02-21

### Changed

- **Versioning reset** _(transitional only)_: All version numbers zeroed and restarted from `0.1.0` as baseline
- **Central server version**: New `server/version.ts` — single source of truth for backend version (eliminates hardcoded strings in `health.ts`, `index.ts`, `swagger.ts`)
- **ABNT NBR compliance**: `dxf_abnt.py` module for ABNT NBR 8196/10582/13142 (scales, title block, paper sizes)
- **Update scripts**: `update-version.sh` and `check-version.sh` now also manage `server/version.ts` and `src/constants.ts`
- **Version tests**: `tests/version.test.ts` extended to verify `src/constants.ts` (`APP_VERSION`) and `server/version.ts` (`SERVER_VERSION`)

## [Historical] Prior to 0.1.0

### Added

- **Versioning system**: Centralized versioning with `VERSION` file as single source of truth
- **CHANGELOG.md**: This file — tracking all notable changes
- **Version update scripts**: Automated scripts for Bash and PowerShell
- **Version consistency tests**: `tests/version.test.ts` validates all files have matching versions
- **CI/CD version check**: GitHub Actions workflow validates version consistency on every push
- **DXF cleanup service**: `dxfCleanupService.ts` — auto-deletes DXF files after 10 minutes
- **OIDC webhook authentication**: Validates Cloud Tasks tokens on `/api/tasks/process-dxf`
- **Zod input validation**: Centralized schemas in `apiSchemas.ts` for all API endpoints
- **Body size limits**: Per-endpoint limits (1MB global, 100KB simple, 5MB complex)
- **Rate limiting on webhook**: 50 requests/minute for Cloud Tasks webhook
- **Firestore integration**: Persistent job status and DXF cache with circuit breaker
- **Auto-healing deployment**: GitHub Actions workflow to self-heal deployment failures
- **Docker Compose**: `docker-compose.yml` for local development
- **Error Boundary**: React error boundary for graceful error handling
- **Custom hooks**: `useFileOperations`, `useSearch`, `useDxfExport`, `useKmlImport`, `useElevationProfile`
- **Centralized logging**: Winston logger replacing console statements
- **Constants file**: `py_engine/constants.py` extracting magic numbers

### Changed

- **Version unification**: Inconsistent versions (package.json: 1.0.0, constants.py: 1.5, useFileOperations.ts: 3.0.0) → all unified to 1.0.0
- **pythonBridge.ts**: Simplified from complex .exe detection to always-use-Python (Docker-first)
- **App.tsx**: Reduced from 620 lines to modular architecture with hooks
- **Health endpoint**: Removed API key prefix exposure — now shows only `configured: boolean`
- **CORS configuration**: Now correctly allows Cloud Run `.run.app` origins
- **Deploy workflow**: Removed IAM permission grants (security best practice — configure once, not per-deploy)
- **Docker multi-stage build**: Fixed Python venv build (removed premature build-essential purge)

### Fixed

- **DXF file not created**: Added directory creation before saving in `dxf_generator.py`
- **JSON parse errors**: Added `return` statements to prevent double-responses in Express handlers
- **Cloud Tasks NOT_FOUND**: Granted `roles/cloudtasks.enqueuer` to correct service account
- **CORS rejection**: Cloud Run service now accepts requests from itself
- **Memory leak**: Fixed global `setInterval` in `jobStatusService.ts` — now stoppable
- **Docker build failure**: Used `/opt/venv/bin/python3` explicitly for dependency verification
- **Service account confusion**: Documented that Cloud Run uses compute SA, not App Engine SA
- **Missing `projection` parameter**: Now passed correctly through the DXF generation pipeline
- **Missing `layers` parameter in dev mode**: Fixed in `cloudTasksService.ts`

### Security

- **GROQ API key**: No longer exposed in `/health` endpoint
- **Webhook authentication**: OIDC token validation implemented
- **Rate limiting**: Applied to webhook and DXF-specific endpoints
- **Input validation**: Zod schemas on all endpoints
- **Body size limits**: Protection against large payload DoS

## Versioning Strategy

### Semantic Versioning

- **MAJOR**: Incompatible API changes or breaking functionality
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, small improvements

### Files with Version

All these files must have consistent versions:
1. `VERSION` — single source of truth
2. `package.json` — Node.js package version
3. `py_engine/constants.py` — Python constant `PROJECT_VERSION`
4. `src/hooks/useFileOperations.ts` — TypeScript constant `PROJECT_VERSION`

### Update Version

```bash
# Linux/Mac
./scripts/update-version.sh 1.1.0

# Windows
.\scripts\update-version.ps1 1.1.0

# Verify consistency
npm run version:check
```

### Supported Pre-release Formats

- Alpha: `1.0.0-alpha.1`
- Beta: `1.0.0-beta.2`
- Release Candidate: `1.0.0-rc.1`
- Build metadata: `1.0.0+20260218`
