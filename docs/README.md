# SIS RUA Documentation

Welcome to the consolidated documentation for the SIS RUA Unified application — a system for converting OpenStreetMap data into DXF CAD files.

## 📚 Documentation Index

### 🚀 Deployment

| Document | Description |
|----------|-------------|
| [deployment/deployment-guide.md](deployment/deployment-guide.md) | Complete deployment guide for Google Cloud Run |
| [deployment/auto-healing.md](deployment/auto-healing.md) | Auto-healing deployment system |
| [deployment/custom-domain.md](deployment/custom-domain.md) | Custom domain setup (replacing default Cloud Run URL) |
| [deployment/github-actions.md](deployment/github-actions.md) | CI/CD workflows with GitHub Actions |
| [deployment/checklists.md](deployment/checklists.md) | Pre/post deployment checklists |

### ☁️ Google Cloud

| Document | Description |
|----------|-------------|
| [cloud/cloud-run.md](cloud/cloud-run.md) | Cloud Run configuration, CORS fixes |
| [cloud/cloud-tasks.md](cloud/cloud-tasks.md) | Cloud Tasks setup, permissions, troubleshooting |
| [cloud/iam.md](cloud/iam.md) | IAM & permissions, Workload Identity Federation, OIDC |
| [cloud/firestore.md](cloud/firestore.md) | Firestore for persistent storage (Phase 3) |

### 📐 DXF Generation

| Document | Description |
|----------|-------------|
| [dxf/dxf-guide.md](dxf/dxf-guide.md) | DXF generation guide, API usage, GROQ analysis, elevation |
| [dxf/dxf-troubleshooting.md](dxf/dxf-troubleshooting.md) | DXF error diagnostics and fixes |

### 🤖 GROQ AI

| Document | Description |
|----------|-------------|
| [groq/groq-guide.md](groq/groq-guide.md) | GROQ integration, configuration, troubleshooting |

### 🐳 Docker

| Document | Description |
|----------|-------------|
| [docker/docker-guide.md](docker/docker-guide.md) | Docker setup, usage, build troubleshooting |

### 🔒 Security

| Document | Description |
|----------|-------------|
| [security/security.md](security/security.md) | Security audit, vulnerability management, antivirus |

### 🏗️ Architecture

| Document | Description |
|----------|-------------|
| [architecture/technical-analysis.md](architecture/technical-analysis.md) | System architecture, tech stack, implementation phases |

### 🔍 Audit

| Document | Description |
|----------|-------------|
| [audit/audit-report.md](audit/audit-report.md) | Complete technical audit report (Feb 2026) |

### 📋 Reference

| Document | Description |
|----------|-------------|
| [reference/quick-reference.md](reference/quick-reference.md) | Essential commands, quick deploy reference |

### 🧪 Testing

| Document | Description |
|----------|-------------|
| [testing/test-results.md](testing/test-results.md) | DXF test results with UTM coordinates |

### 📝 Changelog

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |

---

## 🚀 Quick Start

### Deploy to Production

```bash
# 1. Setup IAM permissions (one-time)
./sisrua_unified/scripts/setup-iam-permissions.sh sisrua-producao

# 2. Deploy
cd sisrua_unified
gcloud run deploy sisrua-app \
  --source=. \
  --region=southamerica-east1 \
  --project=sisrua-producao

# 3. Verify
SERVICE_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format='value(status.url)' \
  --project=sisrua-producao)
curl ${SERVICE_URL}/health
```

### Local Development

```bash
cd sisrua_unified
docker compose up
# Access: http://localhost:8080
```

---

## 📊 Project Status

| Component | Status |
|-----------|--------|
| Backend Tests | ✅ 48/48 passing |
| Frontend Tests | ✅ 32/32 passing |
| Security Scan | ✅ 0 vulnerabilities |
| Docker Build | ✅ Multi-stage working |
| CI/CD Pipeline | ✅ GitHub Actions configured |
| DXF Generation | ✅ Working with Cloud Tasks |
| GROQ Integration | ✅ With graceful fallback |
| Auto-Healing | ✅ Implemented |

---

*Documentation consolidated from 75+ source files. For the application source code, see [sisrua_unified/](../sisrua_unified/).*
