# Security

This document covers security practices, antivirus considerations, vulnerability management, and the security audit results for SIS RUA.

## Security Audit Results

**Date**: February 19, 2026  
**Overall Score**: 8.3/10 (after Phase 1 & 2 fixes; started at 6.9/10)

### Score by Category

| Category | Initial | After Fixes | Status |
|----------|---------|-------------|--------|
| Code Security | 6.5 | 8.5 | ✅ |
| Dependencies | 5.0 | 6.5 | 🟡 |
| Infrastructure | 7.0 | 8.5 | ✅ |
| Architecture | 7.5 | 8.0 | ✅ |
| Documentation | 8.5 | 9.0 | ✅ |
| Tests | 7.0 | 7.0 | 🟡 |

### Fixes Applied

#### Phase 1 (Critical)

1. ✅ **OIDC Webhook Authentication** — Cloud Tasks webhook now validates OIDC tokens
2. ✅ **Dependency Vulnerabilities** — 37 NPM vulnerabilities analyzed and documented
3. ✅ **API Key Exposure** — Removed GROQ key prefix from `/health` endpoint (now shows only `configured: boolean`)

#### Phase 2 (High Priority)

4. ✅ **Body Size Limits** — Reduced from 50MB to 1MB global, 100KB simple, 5MB complex
5. ✅ **Zod Input Validation** — Centralized schemas for all API endpoints
6. ✅ **Webhook Rate Limiting** — 50 requests/minute for Cloud Tasks webhook

## Security Measures Implemented

### Backend

- ✅ Rate limiting (general + DXF-specific)
- ✅ CORS configuration (allowing only `.run.app` and localhost)
- ✅ Request logging with Winston
- ✅ Input validation with Zod schemas
- ✅ OIDC token verification for Cloud Tasks webhook
- ✅ Body size limits to prevent DoS
- ✅ No stack traces in error responses (users see generic messages)
- ✅ API key not logged or exposed

### Infrastructure

- ✅ Workload Identity Federation (no static GCP credentials)
- ✅ Non-root Docker user (`appuser`, UID 10000)
- ✅ Multi-stage Docker build (no build tools in production)
- ✅ Cloud Run auto-scaling (0–10 instances)
- ✅ Managed SSL/TLS via Google

### Frontend

- ✅ No API keys in frontend bundle
- ✅ React XSS protection (automatic escaping)
- ✅ Error boundary for graceful error handling

## Dependency Vulnerabilities

### Production Dependencies

**6 HIGH vulnerabilities** in `minimatch` (via `@google-cloud/tasks` → `gaxios` → `google-gax`)

- **CVE**: GHSA-3ppc-4f35-3m26
- **Type**: ReDoS (Regular Expression Denial of Service)
- **Risk**: LOW in practice — requires specific malicious input, not in critical code paths
- **Resolution**: Wait for `@google-cloud/tasks` update; cannot fix without breaking changes

**Action**: Monitor `@google-cloud/tasks` releases. Do NOT run `npm audit fix --force` (would break the build).

### Development Dependencies

**31 vulnerabilities** in `eslint`, `jest`, `vitest` — these are development tools and **not included in production bundles**.

**Action**: Accept risk; update when major version migration is feasible.

## Antivirus Considerations

Some components of SIS RUA may trigger antivirus false positives:

### PowerShell Scripts (Medium Risk)

Files: `start-dev.ps1`, `scripts/build_release.ps1`, `scripts/verify_dxf_headless.ps1`

**Behaviors that may trigger AV:**
- `Stop-Process` to kill processes
- `Get-NetTCPConnection` to check ports
- Spawning external processes (npm, docker, python)

**Mitigation:** Scripts include security comments explaining their legitimate purpose.

### Python Bridge (Medium Risk)

File: `server/pythonBridge.ts`

**Behaviors that may trigger AV:**
- `spawn()` to execute Python scripts
- Reading stdout/stderr of child processes

**Mitigation:** This is standard behavior for Node.js applications that invoke scripts.

### DXF File Generation (Low Risk)

Dynamic file creation in `public/dxf/` may appear suspicious but is normal application behavior.

### Windows Defender Exclusions

If running locally on Windows and experiencing AV interference:

```powershell
# Add project directory exclusion (run as Administrator)
Add-MpPreference -ExclusionPath "C:\path\to\myworld\sisrua_unified"
```

## Pre-Commit Security Checklist

Before every commit:

- [ ] No secrets/passwords hardcoded in code
- [ ] No `.env` file committed (only `.env.example`)
- [ ] No executable files (`.exe`, `.dll`) committed
- [ ] Input validation implemented for new endpoints
- [ ] Error messages don't expose internal details
- [ ] `npm audit` run and findings documented
- [ ] CORS configuration not overly permissive

## Code Review Security Checklist

- [ ] No use of `eval()` or `Function()`
- [ ] Shell commands use `spawn()` with arrays (not string concatenation)
- [ ] File paths validated before operations
- [ ] No API keys in logs or responses
- [ ] Rate limiting applied to new endpoints
- [ ] Zod schema added for new request body

## Vulnerability Reporting

Report security issues via GitHub Issues with the `security` label, or directly to the repository maintainers.

Do NOT publish vulnerabilities publicly before they are fixed.
