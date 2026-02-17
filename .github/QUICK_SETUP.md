# Quick Setup Guide - GitHub Actions Deployment

## Resumo Rápido

Agora você tem um workflow automático de deployment! 🎉

## O que foi criado:

1. **`.github/workflows/deploy-cloud-run.yml`** - Workflow de deployment automático
2. **`.github/DEPLOYMENT_SETUP.md`** - Documentação completa de configuração

## Próximos Passos:

### 1. Configure os Secrets no GitHub

Vá em: **Settings > Secrets and variables > Actions > New repository secret**

Adicione os seguintes secrets:

| Nome do Secret | Descrição | Onde Encontrar |
|----------------|-----------|----------------|
| `GCP_WIF_PROVIDER` | Workload Identity Provider | Siga instruções em DEPLOYMENT_SETUP.md |
| `GCP_SERVICE_ACCOUNT` | Email da Service Account | GCP IAM > Service Accounts |
| `GCP_PROJECT_ID` | ID do projeto GCP | `sisrua-producao` |
| `GROQ_API_KEY` | Sua chave da API Groq | Copie sua chave atual |
| `GCP_PROJECT` | Nome do projeto | `sisrua-producao` |
| `CLOUD_RUN_BASE_URL` | URL do Cloud Run | Copie sua URL atual |

### 2. Como Funciona:

- **Deployment Automático**: Quando você fizer push para `main` ou `production`
- **Deployment Manual**: Actions > Deploy to Cloud Run > Run workflow

### 3. Comando Original vs Novo Workflow:

**Antes (Manual):**
```bash
gcloud run deploy sisrua-app \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --memory 1024Mi \
  --set-env-vars="..."
```

**Agora (Automático):**
- Apenas faça push para o branch main/production
- OU clique em "Run workflow" no GitHub

## Verificar se está funcionando:

1. Vá para **Actions** no GitHub
2. Você verá o workflow "Deploy to Cloud Run"
3. Após configurar os secrets, faça um push de teste
4. Acompanhe o deployment em tempo real

## Precisa de Ajuda?

Consulte o arquivo `.github/DEPLOYMENT_SETUP.md` para:
- Instruções detalhadas de configuração do Workload Identity
- Comandos para criar Service Accounts
- Troubleshooting de problemas comuns

---

**Status Atual:**
- ✅ Workflow criado
- ⏳ Aguardando configuração de secrets
- ⏳ Pronto para primeiro deployment automático
