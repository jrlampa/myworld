# GitHub Actions & Deployment Configuration

Este diretório contém a configuração de CI/CD para deployment automático no Google Cloud Run.

## 📁 Arquivos

### Workflows
- **`workflows/deploy-cloud-run.yml`** - Workflow principal de deployment automático para Cloud Run

### Documentação
- **`QUICK_SETUP.md`** - Guia rápido de configuração (comece por aqui! 👈)
- **`DEPLOYMENT_SETUP.md`** - Documentação completa e detalhada
- **`SECRETS_TEMPLATE.md`** - Template para configurar secrets no GitHub

## 🚀 Como Começar

1. Leia o **QUICK_SETUP.md** para uma visão geral rápida
2. Configure os secrets seguindo o **SECRETS_TEMPLATE.md**
3. Para detalhes completos, consulte **DEPLOYMENT_SETUP.md**

## 🔑 Secrets Necessários

Configure estes secrets no GitHub (Settings > Secrets and variables > Actions):

- `GCP_WIF_PROVIDER` - Workload Identity Provider
- `GCP_SERVICE_ACCOUNT` - Service Account email
- `GCP_PROJECT_ID` - Project ID (sisrua-producao)
- `GROQ_API_KEY` - Groq API key
- `GCP_PROJECT` - GCP project name
- `CLOUD_RUN_BASE_URL` - Cloud Run service URL

## 🎯 Deployment

### Automático
- Push para branch `main` ou `production`

### Manual
1. Vá para Actions no GitHub
2. Selecione "Deploy to Cloud Run"
3. Clique em "Run workflow"

## 📋 Parâmetros do Deployment

- **Service**: sisrua-app
- **Region**: southamerica-east1
- **Memory**: 1024Mi
- **Auth**: allow-unauthenticated
- **Env Vars**: GROQ_API_KEY, GCP_PROJECT, CLOUD_TASKS_LOCATION, CLOUD_TASKS_QUEUE, CLOUD_RUN_BASE_URL

## ℹ️ Mais Informações

Para detalhes sobre configuração do Workload Identity Federation, permissões necessárias, e troubleshooting, consulte `DEPLOYMENT_SETUP.md`.
