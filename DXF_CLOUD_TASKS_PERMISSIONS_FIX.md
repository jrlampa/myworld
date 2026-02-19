# Resolução do Erro DXF - Cloud Tasks Queue Permissions

## Problema

Erro ao gerar arquivos DXF:
```
DXF Error: Cloud Tasks queue 'sisrua-queue' not found in project 'sisrua-producao' at location 'southamerica-east1'. 
Please create the queue using: gcloud tasks queues create sisrua-queue --location=southamerica-east1
```

**Situação paradoxal**: A fila Cloud Tasks **EXISTE e está RUNNING**, conforme verificado via API:
- Nome da Fila: `sisrua-queue`
- Estado: `RUNNING`
- Localização: `southamerica-east1`
- Projeto: `sisrua-producao`

## Causa Raiz

O erro **NÃO** é porque a fila não existe. O erro ocorre porque a **service account do Cloud Run não tem permissões** para acessar a fila.

### Detalhes Técnicos

1. **Cloud Tasks Client**: O código usa `@google-cloud/tasks` que faz chamadas gRPC para a API do Cloud Tasks
2. **Service Account**: Quando o Cloud Run executa, usa `sisrua-producao@appspot.gserviceaccount.com` (default compute service account)
3. **Erro gRPC**: O erro retorna código `5 NOT_FOUND` quando a service account não tem permissão para **ver** a fila
4. **Autenticação**: O Cloud Tasks tenta autenticar usando OIDC token para chamar o webhook do Cloud Run

### Por que "NOT_FOUND" e não "PERMISSION_DENIED"?

O Google Cloud retorna `NOT_FOUND` em vez de `PERMISSION_DENIED` por questões de **segurança**:
- Se retornasse `PERMISSION_DENIED`, confirmaria que o recurso existe
- Isso seria uma **information disclosure** (vazamento de informação)
- Retornando `NOT_FOUND`, oculta a existência de recursos que você não tem acesso

## Solução Implementada

### 1. Atualização do Workflow de Deploy

**Arquivo**: `.github/workflows/deploy-cloud-run.yml`

#### Novo Step: Grant Cloud Tasks Permissions
```yaml
- name: Grant Cloud Tasks Permissions
  run: |
    SERVICE_ACCOUNT="${{ secrets.GCP_PROJECT_ID }}@appspot.gserviceaccount.com"
    
    echo "Granting Cloud Tasks enqueuer role to ${SERVICE_ACCOUNT}..."
    gcloud projects add-iam-policy-binding ${{ secrets.GCP_PROJECT_ID }} \
      --member="serviceAccount:${SERVICE_ACCOUNT}" \
      --role="roles/cloudtasks.enqueuer" \
      --condition=None
    
    echo "Cloud Tasks permissions granted successfully."
```

#### Novo Step: Grant Cloud Run Invoker Permission
```yaml
- name: Grant Cloud Run Invoker Permission
  run: |
    SERVICE_ACCOUNT="${{ secrets.GCP_PROJECT_ID }}@appspot.gserviceaccount.com"
    
    echo "Granting Cloud Run invoker role to ${SERVICE_ACCOUNT}..."
    gcloud run services add-iam-policy-binding sisrua-app \
      --region=southamerica-east1 \
      --member="serviceAccount:${SERVICE_ACCOUNT}" \
      --role="roles/run.invoker" \
      --project=${{ secrets.GCP_PROJECT_ID }}
    
    echo "Cloud Run invoker permission granted successfully."
```

### 2. Melhorias no Error Handling

**Arquivo**: `sisrua_unified/server/services/cloudTasksService.ts`

#### Constantes gRPC Adicionadas
```typescript
const GRPC_NOT_FOUND_CODE = 5;
const GRPC_PERMISSION_DENIED_CODE = 7;
```

#### Detecção de Erro de Permissão
```typescript
// Check for permission denied errors
if (error.message?.includes('PERMISSION_DENIED') || error.code === GRPC_PERMISSION_DENIED_CODE) {
    const serviceAccount = `${GCP_PROJECT}@appspot.gserviceaccount.com`;
    const errorMsg = `Permission denied to access Cloud Tasks queue '${CLOUD_TASKS_QUEUE}'. ` +
                   `The service account '${serviceAccount}' needs the following roles:\n` +
                   `1. roles/cloudtasks.enqueuer - To create tasks in the queue\n` +
                   `2. roles/run.invoker - To invoke the Cloud Run webhook\n\n` +
                   `Grant permissions using:\n` +
                   `gcloud projects add-iam-policy-binding ${GCP_PROJECT} --member="serviceAccount:${serviceAccount}" --role="roles/cloudtasks.enqueuer"\n` +
                   `gcloud run services add-iam-policy-binding sisrua-app --region=${CLOUD_TASKS_LOCATION} --member="serviceAccount:${serviceAccount}" --role="roles/run.invoker"`;
    throw new Error(errorMsg);
}
```

#### Mensagem Melhorada para NOT_FOUND
```typescript
// Provide more specific error message for missing queue
if (error.message?.includes('NOT_FOUND') || error.code === GRPC_NOT_FOUND_CODE) {
    const errorMsg = `Cloud Tasks queue '${CLOUD_TASKS_QUEUE}' not found in project '${GCP_PROJECT}' at location '${CLOUD_TASKS_LOCATION}'. ` +
                   `Please verify that:\n` +
                   `1. The queue exists: gcloud tasks queues describe ${CLOUD_TASKS_QUEUE} --location=${CLOUD_TASKS_LOCATION} --project=${GCP_PROJECT}\n` +
                   `2. The GCP_PROJECT environment variable is set correctly (current value: '${GCP_PROJECT}')\n` +
                   `3. The service account has permission to access the queue\n\n` +
                   `If the queue doesn't exist, create it using:\n` +
                   `gcloud tasks queues create ${CLOUD_TASKS_QUEUE} --location=${CLOUD_TASKS_LOCATION} --project=${GCP_PROJECT}`;
    throw new Error(errorMsg);
}
```

#### Log Adicional
```typescript
logger.error('Failed to create Cloud Task', {
    taskId,
    error: error.message,
    errorCode: error.code,  // ← Novo: código do erro gRPC
    stack: error.stack,
    queueName: parent,
    gcpProject: GCP_PROJECT,
    location: CLOUD_TASKS_LOCATION,
    queue: CLOUD_TASKS_QUEUE
});
```

### 3. Script de Verificação

**Arquivo**: `sisrua_unified/scripts/verify-cloud-tasks-permissions.sh`

Script para verificar se todas as permissões estão configuradas corretamente:

```bash
./sisrua_unified/scripts/verify-cloud-tasks-permissions.sh
```

O script verifica:
1. ✅ gcloud CLI instalado
2. ✅ Autenticação ativa
3. ✅ Fila existe e está acessível
4. ✅ Service account tem `roles/cloudtasks.enqueuer`
5. ✅ Service account tem `roles/run.invoker`
6. ✅ Variáveis de ambiente configuradas corretamente

## Roles IAM Necessárias

### roles/cloudtasks.enqueuer
**Objetivo**: Permitir criar tasks na fila do Cloud Tasks

**Permissões incluídas**:
- `cloudtasks.tasks.create`
- `cloudtasks.tasks.get`
- `cloudtasks.queues.get`

**Comando**:
```bash
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:sisrua-producao@appspot.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"
```

### roles/run.invoker
**Objetivo**: Permitir invocar o endpoint do Cloud Run via OIDC token

**Permissões incluídas**:
- `run.routes.invoke`

**Comando**:
```bash
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:sisrua-producao@appspot.gserviceaccount.com" \
  --role="roles/run.invoker"
```

## Como o Cloud Tasks Funciona

### Fluxo Completo

```
1. Cliente solicita DXF
   ↓
2. API cria task no Cloud Tasks
   │ └→ Requer: roles/cloudtasks.enqueuer
   ↓
3. Cloud Tasks agenda execução
   ↓
4. Cloud Tasks chama webhook (/api/tasks/process-dxf)
   │ └→ Requer: roles/run.invoker (via OIDC token)
   ↓
5. Webhook gera DXF usando Python
   ↓
6. Cliente recebe URL do arquivo
```

### Autenticação OIDC

O Cloud Tasks usa **OIDC (OpenID Connect)** para autenticar chamadas ao webhook:

```typescript
task = {
    httpRequest: {
        url: `${CLOUD_RUN_BASE_URL}/api/tasks/process-dxf`,
        oidcToken: {
            serviceAccountEmail: `${GCP_PROJECT}@appspot.gserviceaccount.com`
        }
    }
}
```

**Por que precisa de `roles/run.invoker`**:
- O Cloud Run por padrão requer autenticação (mesmo com `--allow-unauthenticated`)
- O endpoint `/api/tasks/process-dxf` precisa validar que a chamada vem do Cloud Tasks
- O token OIDC prova que a chamada foi autenticada pela service account
- A service account precisa de `roles/run.invoker` para gerar o token válido

## Verificação Pós-Deploy

### 1. Verificar Permissões
```bash
# Ver todas as permissões da service account
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.members:sisrua-producao@appspot.gserviceaccount.com"

# Verificar especificamente cloudtasks.enqueuer
gcloud projects get-iam-policy sisrua-producao \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/cloudtasks.enqueuer AND bindings.members:serviceAccount:sisrua-producao@appspot.gserviceaccount.com"

# Verificar run.invoker no serviço
gcloud run services get-iam-policy sisrua-app \
  --region=southamerica-east1 \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/run.invoker"
```

### 2. Verificar Configuração da Fila
```bash
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

### 3. Verificar Variáveis de Ambiente
```bash
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --format="value(spec.template.spec.containers[0].env)"
```

### 4. Usar Script de Verificação
```bash
cd sisrua_unified
./scripts/verify-cloud-tasks-permissions.sh sisrua-producao
```

## Troubleshooting

### Erro: "Queue not found" após deploy
**Causa**: Permissões não foram aplicadas ou propagadas ainda

**Solução**:
1. Executar o script de verificação
2. Se falhar, conceder permissões manualmente
3. Aguardar 1-2 minutos para propagação
4. Testar novamente

### Erro: "Permission denied"
**Causa**: Service account não tem uma das roles necessárias

**Solução**:
```bash
# Conceder ambas as permissões
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:sisrua-producao@appspot.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:sisrua-producao@appspot.gserviceaccount.com" \
  --role="roles/run.invoker"
```

### Erro persiste após conceder permissões
**Causa**: Cache de permissões IAM

**Solução**:
1. Aguardar 1-2 minutos
2. Reiniciar serviço Cloud Run:
```bash
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

## Arquivos Modificados

| Arquivo | Mudanças | Linhas |
|---------|----------|--------|
| `.github/workflows/deploy-cloud-run.yml` | Adicionados 2 steps de permissões IAM | +18 |
| `sisrua_unified/server/services/cloudTasksService.ts` | Melhor error handling e logging | +33 |
| `sisrua_unified/scripts/verify-cloud-tasks-permissions.sh` | Novo script de verificação | +242 (novo) |
| `DXF_CLOUD_TASKS_PERMISSIONS_FIX.md` | Esta documentação | +329 (novo) |

**Total**: 4 arquivos modificados/criados

## Benefícios da Solução

1. ✅ **Automatizado**: Permissões concedidas automaticamente no deploy
2. ✅ **Idempotente**: Seguro executar múltiplas vezes
3. ✅ **Diagnóstico**: Erros agora indicam exatamente o problema
4. ✅ **Verificável**: Script para confirmar configuração correta
5. ✅ **Documentado**: Explicação completa do problema e solução

## Próximos Passos

1. ✅ Deploy usando o workflow atualizado
2. ✅ Executar script de verificação
3. ✅ Testar geração de DXF via `/api/dxf`
4. ✅ Monitorar logs para confirmar sucesso

## Referências

- [Cloud Tasks IAM Roles](https://cloud.google.com/tasks/docs/access-control)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [OIDC Tokens](https://cloud.google.com/run/docs/securing/service-identity#identity_tokens)
- [gRPC Error Codes](https://grpc.github.io/grpc/core/md_doc_statuscodes.html)
