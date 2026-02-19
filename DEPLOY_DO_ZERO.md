# 🚀 Deploy do Zero - Cloud Run SIS RUA

## 📋 Visão Geral

Este guia explica como fazer o deploy completo do zero no Google Cloud Run, após deletar o serviço anterior. Você pode **reutilizar os secrets já configurados no GitHub**.

**Status**: Atualizado em 19/02/2026

---

## ✅ O que você JÁ TEM (pode reutilizar)

Se você já tinha o projeto configurado antes, estes recursos devem continuar existindo:

### 1. Secrets do GitHub ✅
Os secrets configurados em https://github.com/jrlampa/myworld/settings/secrets/actions permanecem mesmo após deletar o serviço Cloud Run:

- `GCP_WIF_PROVIDER` - Workload Identity Provider
- `GCP_SERVICE_ACCOUNT` - Email da service account
- `GCP_PROJECT_ID` - ID do projeto GCP
- `GCP_PROJECT` - Nome do projeto GCP
- `GROQ_API_KEY` - API key do GROQ
- `CLOUD_RUN_BASE_URL` - Será atualizado automaticamente no próximo deploy

### 2. Infraestrutura GCP que deve estar OK ✅
- Projeto GCP: `sisrua-producao` (ou outro nome)
- Workload Identity Federation configurado
- Service Account com permissões adequadas
- APIs habilitadas (serão revalidadas no deploy)

### 3. Workflows do GitHub Actions ✅
Os workflows já estão configurados em `.github/workflows/`:
- `deploy-cloud-run.yml` - Deploy principal
- `pre-deploy.yml` - Validações pré-deploy
- `post-deploy-check.yml` - Verificações pós-deploy
- `health-check.yml` - Monitoramento de saúde
- `version-check.yml` - Validação de versão

---

## 🔧 O que PRECISA SER RECRIADO

Como você deletou o serviço Cloud Run, precisamos recriar:

### 1. Serviço Cloud Run ❌ (será criado automaticamente)
O workflow de deploy criará automaticamente o serviço `sisrua-app`

### 2. Cloud Tasks Queue ❌ (será criado automaticamente)
O workflow de deploy criará automaticamente a fila `sisrua-queue` se não existir

### 3. Permissões IAM ⚠️ (precisa configurar manualmente)
Após deletar o serviço, as permissões específicas do serviço foram perdidas e precisam ser reconfiguradas.

---

## 📝 PASSO A PASSO - Deploy do Zero

### Passo 1: Verificar Secrets do GitHub

Acesse: https://github.com/jrlampa/myworld/settings/secrets/actions

Confirme que estes 6 secrets existem:
- [ ] `GCP_WIF_PROVIDER`
- [ ] `GCP_SERVICE_ACCOUNT`
- [ ] `GCP_PROJECT_ID`
- [ ] `GCP_PROJECT`
- [ ] `GROQ_API_KEY`
- [ ] `CLOUD_RUN_BASE_URL` (será atualizado automaticamente)

Se algum secret estiver faltando, veja a seção "Configurar Secrets" no final deste documento.

### Passo 2: Fazer o Deploy

Você tem 3 opções:

#### Opção A: Deploy Automático via Push (Recomendado)

```bash
# Na sua máquina local, faça um push para main
git checkout main
git pull origin main

# Faça um commit vazio para trigger o deploy
git commit --allow-empty -m "chore: redeploy Cloud Run service from scratch"
git push origin main
```

O workflow será executado automaticamente.

#### Opção B: Deploy Manual via GitHub Actions

1. Acesse: https://github.com/jrlampa/myworld/actions
2. Selecione **"Deploy to Cloud Run"** na lista de workflows
3. Clique em **"Run workflow"**
4. Selecione a branch `main`
5. Clique em **"Run workflow"** (botão verde)
6. Aguarde a execução (5-10 minutos)

#### Opção C: Deploy Manual via gcloud (Avançado)

```bash
cd sisrua_unified

# Autenticar
gcloud auth login

# Configurar projeto
gcloud config set project sisrua-producao

# Deploy
gcloud run deploy sisrua-app \
  --source=. \
  --region=southamerica-east1 \
  --allow-unauthenticated \
  --memory=1024Mi \
  --cpu=2 \
  --timeout=300 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="GROQ_API_KEY=YOUR_KEY,GCP_PROJECT=sisrua-producao,CLOUD_TASKS_LOCATION=southamerica-east1,CLOUD_TASKS_QUEUE=sisrua-queue,NODE_ENV=production"
```

### Passo 3: Aguardar o Deploy

O workflow executará automaticamente:

1. ✅ Validações pré-deploy (testes, linters, verificação de API key)
2. ✅ Habilitação de APIs necessárias
3. ✅ Criação da fila Cloud Tasks (se não existir)
4. ✅ Build e deploy do container
5. ✅ Captura da URL do serviço
6. ✅ Atualização das variáveis de ambiente com a URL

**Tempo estimado**: 5-10 minutos

### Passo 4: Configurar Permissões IAM (IMPORTANTE)

⚠️ **Este passo é OBRIGATÓRIO após o primeiro deploy**

O serviço Cloud Run precisa de permissões para:
- Criar tarefas no Cloud Tasks
- Invocar o próprio webhook quando Cloud Tasks processar tarefas

Execute estes comandos usando uma conta com permissões de Owner ou IAM Admin:

```bash
# 1. Descobrir o número do projeto
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
echo "Project Number: $PROJECT_NUMBER"

# 2. Grant Cloud Tasks enqueuer role
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

# 3. Grant Cloud Run invoker role
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

**Por que isso é necessário?**
- `roles/cloudtasks.enqueuer`: Permite o app criar tarefas assíncronas para geração de DXF
- `roles/run.invoker`: Permite Cloud Tasks chamar o webhook `/api/tasks/process-dxf`

### Passo 5: Verificar que o Deploy Funcionou

#### 5.1 Verificar URL do Serviço

```bash
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format='value(status.url)'
```

Você receberá algo como: `https://sisrua-app-244319582382.southamerica-east1.run.app`

#### 5.2 Testar Health Check

```bash
# Substituir pela URL obtida acima
curl https://sisrua-app-244319582382.southamerica-east1.run.app/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-19T...",
  "version": "..."
}
```

#### 5.3 Testar Busca de Locais

```bash
curl "https://sisrua-app-244319582382.southamerica-east1.run.app/api/search?query=São%20Paulo"
```

Deve retornar resultados de busca.

#### 5.4 Testar Geração de DXF (Assíncrona)

```bash
curl -X POST https://sisrua-app-244319582382.southamerica-east1.run.app/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -23.55052,
    "lon": -46.63331,
    "radius": 500,
    "mode": "local"
  }'
```

Resposta esperada (tarefa criada):
```json
{
  "taskId": "...",
  "status": "queued",
  "estimatedTime": "30-60s"
}
```

### Passo 6: Atualizar Secret CLOUD_RUN_BASE_URL (Opcional)

O workflow atualiza automaticamente a variável de ambiente no Cloud Run, mas você pode também atualizar o secret do GitHub para futuras referências:

```bash
# Obter URL
CLOUD_RUN_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format='value(status.url)')

echo "URL do serviço: $CLOUD_RUN_URL"
```

Depois, atualize manualmente o secret `CLOUD_RUN_BASE_URL` em:
https://github.com/jrlampa/myworld/settings/secrets/actions

---

## 🔍 Verificação Completa

Após deploy, execute esta checklist:

- [ ] Serviço Cloud Run está rodando (status: Ready)
- [ ] Fila Cloud Tasks `sisrua-queue` existe
- [ ] Health check responde com status 200
- [ ] API de busca funciona
- [ ] API de geração DXF aceita requests
- [ ] Permissões IAM configuradas
- [ ] Logs não mostram erros críticos
- [ ] Métricas de CPU/memória normais

---

## 📊 Verificar Recursos Criados

### Cloud Run Service

```bash
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Cloud Tasks Queue

```bash
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

### Permissões IAM

```bash
# Verificar Cloud Tasks permission
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/cloudtasks.enqueuer"

# Verificar Cloud Run permission
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

---

## 🛠️ Troubleshooting

### Problema: Workflow falha com "Service not found"

**Causa**: Primeira vez criando o serviço  
**Solução**: Normal! O workflow cria o serviço automaticamente. Aguarde completar.

### Problema: Workflow falha com "Permission denied"

**Causa**: Workload Identity ou Service Account sem permissões  
**Solução**: Verificar que `GCP_WIF_PROVIDER` e `GCP_SERVICE_ACCOUNT` estão corretos

```bash
# Verificar service account
gcloud iam service-accounts describe YOUR_SERVICE_ACCOUNT \
  --project=sisrua-producao

# Verificar permissões
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.members:YOUR_SERVICE_ACCOUNT"
```

### Problema: Deploy sucesso mas geração de DXF falha

**Causa**: Permissões IAM não configuradas (Passo 4)  
**Solução**: Executar comandos do Passo 4

### Problema: "Rate limit exceeded" nos testes

**Causa**: Rate limiting está funcionando (normal!)  
**Solução**: Aguardar 1 minuto entre requests ou usar diferentes IPs

### Problema: Container em "CrashLoopBackoff"

**Causa**: Erro ao iniciar aplicação  
**Solução**: Verificar logs

```bash
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=100
```

Causas comuns:
- Variável de ambiente faltando
- Porta incorreta (deve ser 8080)
- Dependência Python faltando

---

## 🔐 Configurar Secrets (Se Necessário)

Se você perdeu algum secret ou está configurando pela primeira vez:

### 1. GCP_WIF_PROVIDER

```bash
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)"
```

Formato esperado: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider`

### 2. GCP_SERVICE_ACCOUNT

Formato: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
echo "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

### 3. GCP_PROJECT_ID e GCP_PROJECT

Ambos devem ser: `sisrua-producao` (ou o nome do seu projeto)

### 4. GROQ_API_KEY

Obter em: https://console.groq.com/keys

### 5. CLOUD_RUN_BASE_URL

Será atualizado automaticamente após o deploy. Formato:
`https://sisrua-app-PROJECT_NUMBER.southamerica-east1.run.app`

---

## 📚 Documentação Adicional

Para mais detalhes, consulte:

- **Guia completo de deploy**: `GUIA_DEPLOY.md`
- **Configuração de IAM**: `CLOUD_RUN_DEPLOYMENT_FIX.md`
- **Configuração OIDC**: `CONFIGURACAO_OIDC.md`
- **Setup do GitHub Actions**: `GITHUB_ACTIONS_SETUP.md`

---

## ✅ Resumo - Comandos Rápidos

Para quem já conhece o processo:

```bash
# 1. Trigger deploy via GitHub Actions (ou push para main)

# 2. Aguardar deploy (5-10 min)

# 3. Configurar permissões IAM
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")

gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao

# 4. Testar
CLOUD_RUN_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format='value(status.url)')

curl ${CLOUD_RUN_URL}/health
```

---

## 🎯 Próximos Passos Após Deploy

1. ✅ Monitorar métricas no Cloud Console
2. ✅ Configurar alertas de erro/latência
3. ✅ Testar funcionalidades principais
4. ✅ Validar integração com GROQ API
5. ✅ Documentar URL do serviço em local seguro

---

**Status**: ✅ Documentação completa  
**Última Atualização**: 19/02/2026  
**Testado**: Aguardando execução
