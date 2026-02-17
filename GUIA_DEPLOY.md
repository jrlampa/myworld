# 🚀 Guia de Deploy - SIS RUA Unified

## 📋 Visão Geral

Este guia fornece instruções completas para deploy da aplicação SIS RUA Unified no Google Cloud Run.

**Status**: ✅ Pronto para deploy (após configuração de secrets)

---

## 🎯 Pré-requisitos

### 1. Conta Google Cloud Platform

- Projeto GCP criado: `sisrua-producao` (ou seu nome preferido)
- APIs habilitadas:
  - Cloud Run API
  - Cloud Build API
  - Container Registry API
  - Workload Identity Federation

### 2. Configuração do GitHub

- Repositório: https://github.com/jrlampa/myworld
- Permissões de admin para configurar secrets

---

## 🔐 Configuração de Secrets (OBRIGATÓRIO)

### Passo 1: Acessar Configurações do GitHub

1. Vá para: https://github.com/jrlampa/myworld/settings/secrets/actions
2. Clique em **"New repository secret"**

### Passo 2: Adicionar Secrets Necessários

Configure os seguintes 6 secrets:

| Secret Name | Descrição | Como Obter |
|------------|-----------|------------|
| `GCP_WIF_PROVIDER` | Workload Identity Provider | Ver seção "Workload Identity" abaixo |
| `GCP_SERVICE_ACCOUNT` | Email da Service Account | `244319582382-compute@developer.gserviceaccount.com` |
| `GCP_PROJECT_ID` | ID do Projeto GCP | `sisrua-producao` |
| `GROQ_API_KEY` | Chave da API GROQ | Obter em https://console.groq.com |
| `GCP_PROJECT` | Nome do Projeto GCP | `sisrua-producao` |
| `CLOUD_RUN_BASE_URL` | URL base do Cloud Run | Será gerado no primeiro deploy (pode deixar vazio inicialmente) |

### Passo 3: Configurar Workload Identity Federation

Execute os comandos abaixo no Cloud Shell ou localmente com gcloud:

```bash
# 1. Criar Pool de Identidade
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool"

# 2. Criar Provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='jrlampa/myworld'"

# 3. Obter o Provider ID (copiar para GCP_WIF_PROVIDER)
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)"

# Output será algo como:
# projects/244319582382/locations/global/workloadIdentityPools/github-pool/providers/github-provider

# 4. Permitir que o GitHub Actions use a Service Account
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/jrlampa/myworld"
```

---

## 📦 Estrutura do Deploy

### Dockerfile Multi-Stage

O deploy usa um Dockerfile otimizado com 3 estágios:

1. **Frontend Build**: Compila React/Vite
2. **Backend Build**: Compila TypeScript
3. **Production Runner**: Imagem final com Node.js + Python

**Tamanho estimado**: ~500MB (otimizado)

### Workflow GitHub Actions

Arquivo: `.github/workflows/deploy-cloud-run.yml`

**Trigger automático**:
- Push para `main`
- Push para `production`
- Push para `release/alpha-release`

**Trigger manual**:
- Via GitHub Actions UI

---

## 🚀 Como Fazer Deploy

### Opção 1: Deploy Automático (Recomendado)

Simplesmente faça push para uma das branches protegidas:

```bash
# Certifique-se de estar na branch correta
git checkout main  # ou production ou release/alpha-release

# Faça suas alterações
git add .
git commit -m "feat: nova funcionalidade"

# Push dispara o deploy automaticamente
git push origin main
```

### Opção 2: Deploy Manual via GitHub

1. Vá para: https://github.com/jrlampa/myworld/actions
2. Selecione **"Deploy to Cloud Run"** na lista de workflows
3. Clique em **"Run workflow"**
4. Selecione a branch desejada
5. Clique em **"Run workflow"**
6. Acompanhe o progresso em tempo real

### Opção 3: Deploy Local via gcloud

```bash
cd sisrua_unified

# Deploy direto do código-fonte
gcloud run deploy sisrua-app \
  --source=. \
  --region=southamerica-east1 \
  --allow-unauthenticated \
  --memory=1024Mi \
  --cpu=2 \
  --timeout=300 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="GROQ_API_KEY=${GROQ_API_KEY},GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue,NODE_ENV=production"
```

---

## 🔍 Verificação Pós-Deploy

### 1. Verificar Status do Workflow

- Acessar: https://github.com/jrlampa/myworld/actions
- Verificar se o workflow completou com sucesso ✅

### 2. Testar Endpoints

```bash
# Substituir <URL_DO_CLOUD_RUN> pela URL real do seu serviço

# Health check
curl https://<URL_DO_CLOUD_RUN>/health

# Teste de busca
curl https://<URL_DO_CLOUD_RUN>/api/search?query=São%20Paulo

# Teste de geração de DXF (async)
curl -X POST https://<URL_DO_CLOUD_RUN>/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -23.55052,
    "lon": -46.63331,
    "radius": 500,
    "mode": "local"
  }'
```

### 3. Verificar Logs

```bash
# Via gcloud CLI
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --limit=50

# Ou no Console GCP
# https://console.cloud.google.com/run/detail/southamerica-east1/sisrua-app/logs
```

### 4. Verificar Métricas

No Cloud Console:
- CPU utilization
- Memory usage
- Request count
- Error rate
- Latency (p50, p95, p99)

---

## 🔄 Rollback de Deploy

Se algo der errado, você pode fazer rollback rapidamente:

### Via Console GCP

1. Acessar Cloud Run: https://console.cloud.google.com/run
2. Selecionar `sisrua-app`
3. Ir para aba **"Revisions"**
4. Selecionar a revisão estável anterior
5. Clicar em **"Manage Traffic"**
6. Definir 100% de tráfego para a revisão anterior
7. Salvar

### Via gcloud CLI

```bash
# Listar revisões disponíveis
gcloud run revisions list \
  --service=sisrua-app \
  --region=southamerica-east1

# Redirecionar tráfego para revisão anterior (substituir REVISION_NAME)
gcloud run services update-traffic sisrua-app \
  --region=southamerica-east1 \
  --to-revisions=REVISION_NAME=100
```

---

## 🛠️ Troubleshooting

### Problema: Deploy falha com "secrets not found"

**Solução**: Verificar se todos os 6 secrets estão configurados no GitHub

```bash
# Verificar secrets configurados (não mostra valores)
gh secret list --repo jrlampa/myworld
```

### Problema: "Permission denied" durante deploy

**Solução**: Verificar permissões da Service Account

```bash
# Adicionar permissões necessárias
gcloud projects add-iam-policy-binding sisrua-producao \
  --member=serviceAccount:244319582382-compute@developer.gserviceaccount.com \
  --role=roles/run.admin

gcloud projects add-iam-policy-binding sisrua-producao \
  --member=serviceAccount:244319582382-compute@developer.gserviceaccount.com \
  --role=roles/storage.admin
```

### Problema: Container fica em "CrashLoopBackoff"

**Solução**: Verificar logs para identificar o erro

```bash
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --limit=100
```

Causas comuns:
- Variáveis de ambiente faltando
- Porta incorreta (deve ser 8080)
- Falha ao iniciar Node.js ou Python

### Problema: Timeout durante geração de DXF

**Solução**: Aumentar timeout do Cloud Run

```bash
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --timeout=600  # 10 minutos
```

---

## 📊 Monitoramento

### Configurar Alertas

```bash
# Criar alerta para alta taxa de erros
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="SIS RUA - High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=60s
```

### Dashboards Recomendados

No Cloud Console, criar dashboards para:
- Request rate por endpoint
- P95 latency
- Memory usage
- CPU utilization
- Error rate (4xx, 5xx)
- DXF generation success rate

---

## 💰 Otimização de Custos

### Configurações Recomendadas

```yaml
Resources:
  CPU: 2 cores  # Reduzir para 1 core se baixo tráfego
  Memory: 1024Mi  # Mínimo recomendado
  Timeout: 300s  # 5 minutos
  
Scaling:
  Min instances: 0  # Economiza quando sem tráfego
  Max instances: 10  # Ajustar conforme necessidade
  Concurrency: 80  # Número de requests por container
```

### Monitorar Custos

```bash
# Ver estimativa de custos
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format="value(status.url)"

# Acessar: https://console.cloud.google.com/billing
```

---

## 🔒 Segurança

### Checklist de Segurança

- [ ] Secrets configurados no GitHub (não no código)
- [ ] Workload Identity configurado (sem chaves estáticas)
- [ ] HTTPS obrigatório (padrão no Cloud Run)
- [ ] Service Account com permissões mínimas
- [ ] Logs de auditoria habilitados
- [ ] Rate limiting configurado
- [ ] Input validation implementada
- [ ] CORS configurado corretamente

### Rotação de Secrets

Recomendação: Rotacionar `GROQ_API_KEY` a cada 90 dias

```bash
# 1. Gerar nova chave no console GROQ
# 2. Atualizar secret no GitHub
gh secret set GROQ_API_KEY --body="new_key_here" --repo jrlampa/myworld

# 3. Fazer redeploy
git commit --allow-empty -m "chore: rotate API keys"
git push origin main
```

---

## 📝 Checklist Final de Deploy

### Pré-Deploy
- [ ] Todos os testes passando (backend, frontend, e2e)
- [ ] Code review aprovado
- [ ] Security scan executado (CodeQL)
- [ ] Secrets configurados no GitHub
- [ ] Workload Identity configurado
- [ ] Documentação atualizada

### Durante Deploy
- [ ] Workflow executando sem erros
- [ ] Build completa com sucesso
- [ ] Container registry atualizado
- [ ] Service deployed no Cloud Run

### Pós-Deploy
- [ ] Health check respondendo
- [ ] Endpoints principais funcionando
- [ ] Logs sem erros críticos
- [ ] Métricas normais (CPU, memória)
- [ ] DNS atualizado (se necessário)
- [ ] Atualizar CLOUD_RUN_BASE_URL secret

---

## 🎓 Recursos Adicionais

### Documentação Oficial

- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)

### Scripts Úteis

**Gerar DXF via Script Python**:
```bash
cd sisrua_unified
python3 generate_dxf.py \
  --lat -23.55052 \
  --lon -46.63331 \
  --radius 500 \
  --output sample.dxf \
  --projection utm \
  --verbose
```

**Criar DXF Demo**:
```bash
cd sisrua_unified
python3 create_demo_dxf.py --output demo.dxf
```

---

## 📞 Suporte

### Em Caso de Problemas

1. Verificar logs do Cloud Run
2. Consultar este guia de troubleshooting
3. Verificar status do GitHub Actions
4. Revisar configuração de secrets

### Contato

- GitHub Issues: https://github.com/jrlampa/myworld/issues
- Documentação adicional: Ver arquivos `SECURITY_DEPLOYMENT_AUDIT.md` e `WORK_COMPLETED.md`

---

**Última Atualização**: 2026-02-17  
**Versão**: 1.0  
**Status**: ✅ Pronto para Produção
