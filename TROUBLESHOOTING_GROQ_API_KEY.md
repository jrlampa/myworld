# 🔧 Troubleshooting GROQ_API_KEY no Cloud Run

## Problema Comum

A variável `GROQ_API_KEY` está configurada no Cloud Run, mas a aplicação retorna erros 500 ao tentar usar a API Groq.

---

## 1. Verificar se a Variável Está Configurada

### Método 1: Health Check (Recomendado)

```bash
curl https://sisrua-app-244319582382.southamerica-east1.run.app/health | jq
```

**Resposta Esperada:**
```json
{
  "status": "online",
  "groqApiKey": {
    "configured": true,
    "length": 56,
    "prefix": "gsk_xxx"
  }
}
```

**Indicadores:**
- ✅ `configured: true` - Variável está presente
- ✅ `length: 56` - Chave tem tamanho correto (chaves Groq têm ~56 caracteres)
- ✅ `prefix: "gsk_xxx"` - Prefixo correto (chaves Groq começam com `gsk_`)

**Problemas Comuns:**
- ❌ `configured: false` - Variável não está definida
- ❌ `length: 0` - Variável vazia
- ❌ `prefix: "NOT_SET"` - Variável não configurada

### Método 2: Verificar Configuração do Cloud Run

```bash
gcloud run services describe sisrua-app \
  --region southamerica-east1 \
  --format='get(spec.template.spec.containers[0].env)'
```

Procure por:
```yaml
- name: GROQ_API_KEY
  value: gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 2. Verificar Nome da Variável

**Nome CORRETO:** `GROQ_API_KEY` (exatamente assim, case-sensitive)

**Nomes INCORRETOS que NÃO funcionam:**
- ❌ `groq_api_key` (minúsculas)
- ❌ `GROQAPIKEY` (sem underscore)
- ❌ `GROQ_KEY` (faltando `_API`)
- ❌ `GROQ API KEY` (com espaços)

---

## 3. Verificar Validade da Chave

### Formato Correto

Chaves Groq válidas:
- ✅ Começam com `gsk_`
- ✅ Têm aproximadamente 56 caracteres
- ✅ Contêm apenas caracteres alfanuméricos e underscores

**Exemplo:**
```
gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Testar a Chave Diretamente

```bash
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer ${GROQ_API_KEY}"
```

**Resposta Esperada (Chave Válida):**
```json
{
  "object": "list",
  "data": [...]
}
```

**Erros Comuns:**
- `401 Unauthorized` - Chave inválida ou expirada
- `429 Too Many Requests` - Limite de taxa excedido
- `403 Forbidden` - Chave revogada

---

## 4. Verificar Logs da Aplicação

### Logs de Inicialização

```bash
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=sisrua-app AND \
  jsonPayload.message='Server starting with environment configuration'" \
  --limit 5 --format json | jq '.[] | .jsonPayload'
```

**O que procurar:**
```json
{
  "message": "Server starting with environment configuration",
  "hasGroqApiKey": true,
  "groqKeyLength": 56,
  "groqKeyPrefix": "gsk_xxx"
}
```

### Logs de Requisição

```bash
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=sisrua-app AND \
  jsonPayload.message='GROQ API analysis requested'" \
  --limit 10 --format json | jq '.[] | .jsonPayload'
```

**O que procurar:**
```json
{
  "message": "GROQ API analysis requested",
  "hasApiKey": true,
  "apiKeyLength": 56,
  "apiKeyPrefix": "gsk_xxx"
}
```

### Logs de Erro

```bash
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=sisrua-app AND \
  jsonPayload.message='Analysis error'" \
  --limit 10 --format json | jq '.[] | .jsonPayload'
```

**Tipos de Erro:**

**1. Chave Inválida (401):**
```json
{
  "error": "...",
  "isAuthError": true
}
```
**Solução:** Gerar nova chave em https://console.groq.com/keys

**2. Rate Limit (429):**
```json
{
  "error": "...",
  "isRateLimitError": true
}
```
**Solução:** Aguardar ou fazer upgrade do plano Groq

**3. Erro de Rede:**
```json
{
  "error": "...",
  "isNetworkError": true
}
```
**Solução:** Verificar conectividade do Cloud Run

---

## 5. Configurar/Atualizar a Variável

### Método 1: Via gcloud CLI

```bash
gcloud run services update sisrua-app \
  --update-env-vars GROQ_API_KEY=gsk_seu_token_aqui \
  --region southamerica-east1
```

### Método 2: Via Google Cloud Console

1. Acesse: https://console.cloud.google.com/run
2. Selecione o serviço `sisrua-app`
3. Clique em "EDIT & DEPLOY NEW REVISION"
4. Na seção "Variables & Secrets"
5. Adicione/Edite:
   - **Nome:** `GROQ_API_KEY`
   - **Valor:** Sua chave Groq
6. Clique em "DEPLOY"

### Método 3: Usar Secret Manager (Recomendado para Produção)

```bash
# 1. Criar secret
echo -n "gsk_seu_token_aqui" | gcloud secrets create groq-api-key \
  --data-file=- \
  --replication-policy=automatic

# 2. Dar permissão ao Cloud Run
gcloud secrets add-iam-policy-binding groq-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 3. Atualizar serviço
gcloud run services update sisrua-app \
  --update-secrets GROQ_API_KEY=groq-api-key:latest \
  --region southamerica-east1
```

---

## 6. Verificar Nova Implantação

Após atualizar a variável, você DEVE implantar uma nova revisão:

```bash
# Forçar nova implantação
gcloud run services update sisrua-app \
  --region southamerica-east1 \
  --no-traffic  # Não redireciona tráfego ainda

# Depois de verificar, redirecionar tráfego
gcloud run services update-traffic sisrua-app \
  --to-latest \
  --region southamerica-east1
```

---

## 7. Testar a Funcionalidade

### Via API

```bash
curl -X POST https://sisrua-app-244319582382.southamerica-east1.run.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "stats": {"buildings": 10, "roads": 5, "trees": 20},
    "locationName": "Test Location"
  }' | jq
```

**Resposta de Sucesso:**
```json
{
  "analysis": "**Análise Urbana Profissional**\n\n..."
}
```

**Erros Possíveis:**

**Chave Não Configurada (503):**
```json
{
  "error": "GROQ_API_KEY not configured",
  "analysis": "**Análise AI Indisponível**..."
}
```

**Chave Inválida (500):**
```json
{
  "error": "Analysis failed",
  "details": "401 unauthorized...",
  "analysis": "**Erro de Autenticação**..."
}
```

**Rate Limit (500):**
```json
{
  "error": "Analysis failed",
  "details": "429 rate limit...",
  "analysis": "**Limite de Taxa Excedido**..."
}
```

---

## 8. Checklist de Diagnóstico

Use este checklist para diagnosticar problemas:

- [ ] **Health check mostra `configured: true`**
  ```bash
  curl .../health | jq '.groqApiKey.configured'
  ```

- [ ] **Chave tem tamanho correto (~56 caracteres)**
  ```bash
  curl .../health | jq '.groqApiKey.length'
  ```

- [ ] **Prefixo é `gsk_`**
  ```bash
  curl .../health | jq '.groqApiKey.prefix'
  ```

- [ ] **Logs de inicialização mostram chave**
  ```bash
  gcloud logging read "jsonPayload.hasGroqApiKey=true" --limit 1
  ```

- [ ] **Chave funciona diretamente na API Groq**
  ```bash
  curl https://api.groq.com/openai/v1/models \
    -H "Authorization: Bearer $GROQ_API_KEY"
  ```

- [ ] **Nenhum arquivo .env local sobrepondo**
  - Verificar se não há `.env` no container
  - Verificar variáveis em docker-compose.yml

- [ ] **Nova revisão implantada após mudança**
  ```bash
  gcloud run revisions list --service sisrua-app --region southamerica-east1
  ```

---

## 9. Problemas Comuns e Soluções

### Problema: Health check mostra `configured: false`

**Causa:** Variável não está definida no Cloud Run

**Solução:**
```bash
gcloud run services update sisrua-app \
  --update-env-vars GROQ_API_KEY=sua_chave \
  --region southamerica-east1
```

---

### Problema: Erro 401 Unauthorized

**Causa:** Chave inválida, expirada ou revogada

**Solução:**
1. Gerar nova chave: https://console.groq.com/keys
2. Atualizar no Cloud Run
3. Implantar nova revisão

---

### Problema: Erro 429 Too Many Requests

**Causa:** Limite de taxa da API Groq excedido

**Solução:**
- Aguardar alguns minutos
- Fazer upgrade do plano Groq
- Implementar cache de resultados

---

### Problema: Variável muda de volta para vazio

**Causa:** Arquivo `.env` ou configuração sobrepondo

**Solução:**
1. Verificar se há `.env` sendo copiado para o container
2. Verificar docker-compose.yml
3. Remover qualquer configuração que sobrescreva

---

### Problema: Funciona localmente mas não no Cloud Run

**Causa:** Diferença entre ambiente local e produção

**Solução:**
1. Verificar logs de inicialização no Cloud Run
2. Confirmar que variável está na revisão ativa
3. Testar usando Secret Manager em vez de env var

---

## 10. Obter Chave Groq

Se você não tem uma chave Groq:

1. **Acesse:** https://console.groq.com/
2. **Crie uma conta** (gratuita)
3. **Vá para:** API Keys
4. **Clique em:** "Create API Key"
5. **Copie a chave** (começa com `gsk_`)
6. **Configure no Cloud Run** conforme seção 5

**IMPORTANTE:** A chave só é mostrada uma vez. Salve-a em local seguro!

---

## 11. Segurança

**NÃO:**
- ❌ Commitar chave no código
- ❌ Colocar em arquivos `.env` versionados
- ❌ Logar o valor completo da chave

**SIM:**
- ✅ Usar Secret Manager para produção
- ✅ Usar variáveis de ambiente do Cloud Run
- ✅ Logar apenas prefixo e tamanho
- ✅ Rotacionar chaves periodicamente

---

## 12. Contato e Suporte

Se após seguir este guia o problema persistir:

**Coletar informações:**
```bash
# Health check
curl https://sisrua-app-244319582382.southamerica-east1.run.app/health > health.json

# Logs de inicialização
gcloud logging read "jsonPayload.message='Server starting'" \
  --limit 5 --format json > startup.log

# Logs de erro
gcloud logging read "severity>=ERROR" \
  --limit 20 --format json > errors.log
```

**Verificar documentação:**
- Groq API: https://console.groq.com/docs
- Cloud Run: https://cloud.google.com/run/docs

---

**Última atualização:** 2026-02-18
**Versão:** 1.0
