# GitHub Actions Deployment Setup

Este documento explica como configurar o deployment automático para o Google Cloud Run usando GitHub Actions.

## ⚠️ Pré-requisito: Configuração de Permissões IAM

**IMPORTANTE**: Antes de executar o primeiro deployment, você deve configurar as permissões IAM necessárias. Consulte:
- **[IAM_SETUP_REQUIRED.md](IAM_SETUP_REQUIRED.md)** - Guia completo de configuração de permissões IAM

Estas permissões são necessárias para que o Cloud Run possa usar Cloud Tasks para processar arquivos DXF de forma assíncrona.

## Workflow Criado

O workflow `.github/workflows/deploy-cloud-run.yml` foi configurado para fazer deployment automático do aplicativo `sisrua-app` no Google Cloud Run.

## Triggers do Deployment

O deployment será executado automaticamente quando:
- Houver push para o branch `main` ou `production`
- For acionado manualmente via workflow_dispatch no GitHub

## Configuração Necessária

### 1. Secrets do GitHub

Configure os seguintes secrets no seu repositório GitHub (Settings > Secrets and variables > Actions):

#### Secrets de Autenticação GCP:
- `GCP_WIF_PROVIDER`: O Workload Identity Provider do Google Cloud
  - Formato: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`
  
- `GCP_SERVICE_ACCOUNT`: Email da Service Account do Google Cloud
  - Formato: `SERVICE_ACCOUNT_NAME@PROJECT_ID.iam.gserviceaccount.com`

- `GCP_PROJECT_ID`: ID do projeto no Google Cloud
  - Exemplo: `sisrua-producao`

#### Secrets da Aplicação:
- `GROQ_API_KEY`: Chave da API Groq
  - Exemplo: `gsk_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

- `GCP_PROJECT`: Nome do projeto GCP para variáveis de ambiente
  - Exemplo: `sisrua-producao`

- `CLOUD_RUN_BASE_URL`: URL base do Cloud Run
  - Exemplo: `https://sisrua-app-XXXXXXXXXXXX.southamerica-east1.run.app`

### 2. Configuração do Workload Identity Federation

Para configurar a autenticação sem chaves (recomendado), siga estes passos:

```bash
# 1. Criar o Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project="sisrua-producao" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# 2. Criar o Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="sisrua-producao" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner=='jrlampa'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 3. Criar Service Account (se ainda não existir)
gcloud iam service-accounts create github-actions-deployer \
  --display-name="GitHub Actions Deployer"

# 4. Dar permissões à Service Account
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:github-actions-deployer@sisrua-producao.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:github-actions-deployer@sisrua-producao.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# 5. Permitir que o GitHub Actions use a Service Account
# NOTA: Substitua <YOUR_PROJECT_NUMBER> pelo número do seu projeto (não o ID)
# Para obter o número do projeto: gcloud projects describe sisrua-producao --format="value(projectNumber)"
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-deployer@sisrua-producao.iam.gserviceaccount.com \
  --project="sisrua-producao" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/<YOUR_PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-pool/attribute.repository/jrlampa/myworld"
```

### 3. Obter os Valores dos Secrets

```bash
# Obter o Workload Identity Provider
gcloud iam workload-identity-pools providers describe github-provider \
  --project="sisrua-producao" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"

# Resultado será algo como:
# projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

## Configuração dos Parâmetros do Deployment

O workflow está configurado com os seguintes parâmetros (conforme especificado):

- **Service Name**: `sisrua-app`
- **Region**: `southamerica-east1`
- **Memory**: `1024Mi`
- **Authentication**: `--allow-unauthenticated`
- **Environment Variables**:
  - `GROQ_API_KEY`: Da secret `GROQ_API_KEY`
  - `GCP_PROJECT`: Da secret `GCP_PROJECT`
  - `CLOUD_TASKS_LOCATION`: `southamerica-east1`
  - `CLOUD_TASKS_QUEUE`: `sisrua-queue`
  - `CLOUD_RUN_BASE_URL`: Da secret `CLOUD_RUN_BASE_URL`

## Executar Deployment Manual

Para executar o deployment manualmente:

1. Vá para a aba "Actions" no GitHub
2. Selecione o workflow "Deploy to Cloud Run"
3. Clique em "Run workflow"
4. Escolha o branch e clique em "Run workflow"

## Monitoramento

Após configurar, você pode:
- Ver os logs de deployment na aba "Actions" do GitHub
- Monitorar o serviço no Google Cloud Console
- Verificar os logs da aplicação no Cloud Run

## Troubleshooting

### Erro de Autenticação
- Verifique se os secrets `GCP_WIF_PROVIDER` e `GCP_SERVICE_ACCOUNT` estão corretos
- Confirme que a Service Account tem as permissões necessárias

### Erro de Deploy
- Verifique os logs no GitHub Actions
- Confirme que o projeto GCP e região estão corretos
- Verifique se todas as environment variables estão configuradas

### Build Falha
- Verifique se o código tem Dockerfile ou se está usando source deployment
- Confirme que todas as dependências estão no repositório
