# 🔧 Troubleshooting - Deploy do Zero

**Guia rápido de solução de problemas para deploy do Cloud Run do zero**

---

## ❌ Erro: "Missing secret: CLOUD_RUN_BASE_URL"

### Sintoma
```
Missing secret: CLOUD_RUN_BASE_URL
Error: Process completed with exit code 1.
```

### Causa
Este erro não deve mais ocorrer - foi corrigido para permitir primeiro deploy sem este secret.

### Solução
```bash
# Atualize seu repositório local
git pull origin main

# O secret CLOUD_RUN_BASE_URL agora é opcional para primeiro deploy
```

Se ainda ocorrer, adicione um valor temporário:
```bash
gh secret set CLOUD_RUN_BASE_URL --body="pending" --repo jrlampa/myworld
```

Será atualizado automaticamente após o primeiro deploy bem-sucedido.

---

## ❌ Erro: "Service [sisrua-app] not found"

### Sintoma
```
ERROR: (gcloud.run.services.describe) Service [sisrua-app] could not be found.
```

### Causa
**Isso é NORMAL no primeiro deploy!** O serviço ainda não existe.

### Solução
✅ **Nenhuma ação necessária!** 

O comando `gcloud run deploy` com flag `--source=.` criará o serviço automaticamente.

Continue aguardando o workflow completar.

---

## ❌ Erro: "Permission denied" ou "Access denied"

### Sintoma
```
ERROR: (gcloud.run.deploy) User [...] does not have permission to access project [...]
```

ou

```
ERROR: (gcloud.projects.add-iam-policy-binding) [...] does not have permission
```

### Causa
Workload Identity Federation ou Service Account não estão configurados corretamente.

### Solução

#### 1. Verificar se Workload Identity existe

```bash
gcloud iam workload-identity-pools describe github-pool \
  --location=global \
  --project=sisrua-producao
```

Se retornar erro "not found", você precisa criar:

```bash
# Criar Pool
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool" \
  --project=sisrua-producao

# Criar Provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='jrlampa/myworld'" \
  --project=sisrua-producao

# Obter Provider ID para o secret GCP_WIF_PROVIDER
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)" \
  --project=sisrua-producao
```

#### 2. Conceder permissões ao Service Account

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")

# Permitir GitHub Actions usar a Service Account
gcloud iam service-accounts add-iam-policy-binding \
  ${PROJECT_NUMBER}-compute@developer.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/jrlampa/myworld" \
  --project=sisrua-producao

# Dar permissões de Cloud Run ao Service Account
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

#### 3. Atualizar secrets do GitHub

```bash
# Obter o WIF Provider ID
WIF_PROVIDER=$(gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)" \
  --project=sisrua-producao)

echo "GCP_WIF_PROVIDER: $WIF_PROVIDER"

# Atualizar secret
gh secret set GCP_WIF_PROVIDER --body="$WIF_PROVIDER" --repo jrlampa/myworld

# Verificar Service Account
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "GCP_SERVICE_ACCOUNT: $SERVICE_ACCOUNT"

gh secret set GCP_SERVICE_ACCOUNT --body="$SERVICE_ACCOUNT" --repo jrlampa/myworld
```

---

## ❌ Erro: "API [...] is not enabled"

### Sintoma
```
ERROR: (gcloud.run.deploy) API [run.googleapis.com] not enabled on project [...]
```

### Causa
APIs necessárias não estão habilitadas no projeto GCP.

### Solução

O workflow tenta habilitar automaticamente, mas você pode fazer manualmente:

```bash
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  cloudtasks.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project=sisrua-producao
```

Aguarde 1-2 minutos para as APIs serem habilitadas, depois tente o deploy novamente.

---

## ❌ Erro: "Build failed" ou "Docker build error"

### Sintoma
```
ERROR: build step 0 "..." failed
```

ou

```
failed to solve: process "/bin/sh -c ..." did not complete successfully
```

### Causa
Problema no processo de build do Docker (dependências, código, etc.)

### Solução

#### 1. Testar build localmente

```bash
cd sisrua_unified
docker build -t sisrua-test .
```

Isso mostrará exatamente onde o build está falhando.

#### 2. Problemas comuns

**Dependências Node.js:**
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
```

**Dependências Python:**
```bash
# Verificar requirements.txt
cat py_engine/requirements.txt

# Testar instalação
pip install -r py_engine/requirements.txt
```

**Memória insuficiente:**
```bash
# Aumentar memória do Docker (Docker Desktop)
# Settings > Resources > Memory > Aumentar para 4GB+
```

---

## ❌ Erro: Container em "CrashLoopBackoff"

### Sintoma
No Cloud Console, o serviço mostra status "CrashLoopBackoff" ou "Unhealthy"

### Causa
Container está iniciando mas crashando logo em seguida.

### Solução

#### 1. Verificar logs

```bash
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=100
```

#### 2. Causas comuns

**Variável de ambiente faltando:**
```bash
# Adicionar variável faltante
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --update-env-vars="MISSING_VAR=value"
```

**Porta incorreta:**
O Cloud Run espera que o app ouça na porta 8080. Verifique em `server/index.ts`:
```typescript
const PORT = process.env.PORT || 8080;
```

**Dependência Python faltando:**
Verificar que todas as dependências estão em `py_engine/requirements.txt`

**Erro no código:**
Verificar logs para stack trace e corrigir o código

---

## ❌ Erro: Cloud Tasks queue não existe

### Sintoma
```
ERROR: (gcloud.tasks.queues.describe) Queue [sisrua-queue] not found
```

### Causa
A fila Cloud Tasks não foi criada (ou foi deletada junto com o serviço).

### Solução

O workflow cria automaticamente a fila. Mas você pode criar manualmente:

```bash
gcloud tasks queues create sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=10
```

---

## ❌ Erro: DXF generation falha (403 Forbidden)

### Sintoma
```json
{
  "error": "Failed to create task",
  "details": "403 Forbidden"
}
```

### Causa
Permissões IAM não configuradas (passo OBRIGATÓRIO após deploy).

### Solução

Execute os comandos de permissões IAM:

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")

# Cloud Tasks enqueuer permission
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

# Cloud Run invoker permission
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

Aguarde 1-2 minutos para propagação das permissões.

---

## ❌ Erro: "Rate limit exceeded"

### Sintoma
```json
{
  "error": "Too many requests"
}
```

### Causa
Rate limiting está funcionando corretamente (proteção contra abuse).

### Solução

✅ **Isso é normal!** O app tem rate limiting:
- 100 requests/minuto por IP (global)
- 50 requests/minuto no webhook

Aguarde 1 minuto ou use outro IP/dispositivo para testar.

---

## ❌ Erro: GROQ API falha

### Sintoma
```json
{
  "error": "GROQ API error",
  "message": "Invalid API key"
}
```

### Causa
API key do GROQ inválida, expirada, ou não configurada.

### Solução

#### 1. Obter nova API key

Acesse: https://console.groq.com/keys

#### 2. Atualizar secret no GitHub

```bash
gh secret set GROQ_API_KEY --body="gsk_..." --repo jrlampa/myworld
```

#### 3. Redeploy

```bash
git commit --allow-empty -m "chore: update GROQ API key"
git push origin main
```

---

## ❌ Workflow fica travado em "Waiting"

### Sintoma
Workflow não inicia ou fica em "Queued"/"Waiting" indefinidamente.

### Causa
- Concurrency group bloqueado (outro deploy em andamento)
- Runners do GitHub indisponíveis

### Solução

#### 1. Cancelar deploy anterior

Se houver outro deploy em andamento:
1. Acessar https://github.com/jrlampa/myworld/actions
2. Encontrar workflow em andamento
3. Clicar em "Cancel workflow"

#### 2. Aguardar runners

GitHub Actions pode ter fila de espera. Aguarde alguns minutos.

#### 3. Tentar novamente

Se não resolver após 10 minutos, cancele e inicie novamente.

---

## 🔍 Comandos Úteis de Diagnóstico

### Verificar status do serviço

```bash
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Ver últimos logs

```bash
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

### Ver logs em tempo real

```bash
gcloud run services logs tail sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Verificar revisões

```bash
gcloud run revisions list \
  --service=sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Verificar secrets do GitHub

```bash
gh secret list --repo jrlampa/myworld
```

### Verificar permissões IAM

```bash
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")

# Listar todas permissões da service account
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.members:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
```

---

## 📞 Ainda com Problemas?

Se nenhuma solução acima resolveu:

1. **Verificar logs detalhados** do GitHub Actions e Cloud Run
2. **Consultar documentação** em `DEPLOY_DO_ZERO.md`
3. **Verificar status do GCP**: https://status.cloud.google.com/
4. **Abrir issue** no repositório com logs completos

---

**Última Atualização**: 19/02/2026  
**Versão**: 1.0
