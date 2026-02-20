# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-18

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
