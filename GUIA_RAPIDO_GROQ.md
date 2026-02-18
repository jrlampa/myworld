# 🎯 GUIA RÁPIDO: Diagnosticar GROQ_API_KEY em 3 Passos

## ⚡ Diagnóstico Rápido (1 minuto)

### Passo 1: Health Check (15 segundos)

```bash
curl https://sisrua-app-244319582382.southamerica-east1.run.app/health | jq '.groqApiKey'
```

**Interpretação:**

| Resultado | Status | Ação |
|-----------|--------|------|
| `configured: true`<br>`length: 56`<br>`prefix: "gsk_xxx"` | ✅ **OK** | Chave configurada corretamente |
| `configured: false`<br>`length: 0` | ❌ **ERRO** | [Ver Solução 1](#solução-1-configurar-variável) |
| `configured: true`<br>`length: 20` | ⚠️ **SUSPEITO** | Chave muito curta - [Ver Solução 2](#solução-2-chave-inválida) |

---

### Passo 2: Testar Funcionalidade (15 segundos)

```bash
curl -X POST https://sisrua-app-244319582382.southamerica-east1.run.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"stats": {"buildings": 10}, "locationName": "Test"}' | jq
```

**Interpretação:**

| Resposta | Status | Ação |
|----------|--------|------|
| `{"analysis": "..."}` | ✅ **OK** | Tudo funcionando! |
| `{"error": "GROQ_API_KEY not configured"}` | ❌ **503** | [Ver Solução 1](#solução-1-configurar-variável) |
| `{"analysis": "**Erro de Autenticação**"}` | ❌ **500** | [Ver Solução 2](#solução-2-chave-inválida) |
| `{"analysis": "**Limite de Taxa**"}` | ⚠️ **500** | [Ver Solução 3](#solução-3-rate-limit) |

---

### Passo 3: Verificar Logs (30 segundos)

```bash
gcloud logging read "resource.labels.service_name=sisrua-app AND \
  (jsonPayload.hasGroqApiKey OR jsonPayload.isAuthError OR jsonPayload.isRateLimitError)" \
  --limit 5 --format json | jq '.[].jsonPayload | {
    message,
    hasGroqApiKey,
    groqKeyPrefix,
    isAuthError,
    isRateLimitError,
    isNetworkError
  }'
```

**Interpretação:**

| Log | Problema | Ação |
|-----|----------|------|
| `hasGroqApiKey: true` | ✅ **OK** | Chave está disponível |
| `hasGroqApiKey: false` | ❌ **ERRO** | [Ver Solução 1](#solução-1-configurar-variável) |
| `isAuthError: true` | ❌ **ERRO** | [Ver Solução 2](#solução-2-chave-inválida) |
| `isRateLimitError: true` | ⚠️ **LIMITE** | [Ver Solução 3](#solução-3-rate-limit) |
| `isNetworkError: true` | ⚠️ **REDE** | [Ver Solução 4](#solução-4-erro-de-rede) |

---

## 🔧 Soluções Rápidas

### Solução 1: Configurar Variável

**Problema:** `configured: false` ou `GROQ_API_KEY not configured`

```bash
# 1. Obter chave (se não tiver)
# Acesse: https://console.groq.com/keys

# 2. Configurar no Cloud Run
gcloud run services update sisrua-app \
  --update-env-vars GROQ_API_KEY=gsk_sua_chave_aqui \
  --region southamerica-east1

# 3. Aguardar deploy (2-3 minutos)

# 4. Verificar
curl https://sisrua-app-244319582382.southamerica-east1.run.app/health | jq '.groqApiKey'
```

**Resultado Esperado:**
```json
{
  "configured": true,
  "length": 56,
  "prefix": "gsk_xxx"
}
```

---

### Solução 2: Chave Inválida

**Problema:** `isAuthError: true` ou `Erro de Autenticação`

```bash
# 1. Gerar nova chave
# Acesse: https://console.groq.com/keys
# Clique em "Create API Key"
# Copie a chave (começa com gsk_)

# 2. Atualizar no Cloud Run
gcloud run services update sisrua-app \
  --update-env-vars GROQ_API_KEY=gsk_nova_chave_aqui \
  --region southamerica-east1

# 3. Testar diretamente
export GROQ_API_KEY=gsk_sua_chave
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"

# Deve retornar lista de modelos
```

---

### Solução 3: Rate Limit

**Problema:** `isRateLimitError: true` ou `Limite de Taxa Excedido`

**Opção A: Aguardar (Grátis)**
```bash
# Aguarde 1-2 minutos e tente novamente
sleep 120
curl -X POST .../api/analyze -d '...'
```

**Opção B: Upgrade do Plano (Pago)**
```bash
# Acesse: https://console.groq.com/settings/billing
# Faça upgrade para plano pago (mais requisições/minuto)
```

**Opção C: Implementar Cache (Futuro)**
- Cache de resultados para reduzir chamadas à API
- Implementação futura recomendada

---

### Solução 4: Erro de Rede

**Problema:** `isNetworkError: true` ou `Erro de Conexão`

```bash
# 1. Verificar status da API Groq
curl https://status.groq.com/

# 2. Verificar conectividade do Cloud Run
gcloud run services describe sisrua-app \
  --region southamerica-east1 \
  --format='get(spec.template.spec.containers[0].resources)'

# 3. Testar de outro local
curl https://api.groq.com/openai/v1/models

# 4. Se API está up mas Cloud Run não alcança:
# - Verificar VPC/firewall settings
# - Verificar Cloud Run egress configuration
```

---

## 📊 Fluxograma de Diagnóstico

```
┌─────────────────────────┐
│  curl .../health        │
│  Verificar groqApiKey   │
└────────────┬────────────┘
             │
    ┌────────┴────────┐
    │                 │
configured?         configured?
  false               true
    │                 │
    ▼                 ▼
┌─────────┐      ┌──────────┐
│Solução 1│      │  Testar  │
│Configurar│      │  /analyze│
└─────────┘      └─────┬────┘
                       │
              ┌────────┼────────┐
              │        │        │
             OK      503      500
              │        │        │
              ▼        ▼        ▼
          ┌────┐  ┌────────┐  Ver logs
          │ ✅ │  │Solução1│  para tipo
          └────┘  └────────┘  de erro
                              │
                    ┌─────────┼─────────┐
                    │         │         │
                isAuth?   isRate?   isNetwork?
                  yes       yes        yes
                    │         │         │
                    ▼         ▼         ▼
                Solução2  Solução3  Solução4
```

---

## ⏱️ Tempos Estimados

| Tarefa | Tempo |
|--------|-------|
| **Diagnóstico Completo** | 1 minuto |
| **Configurar Variável** | 3 minutos |
| **Gerar Nova Chave** | 2 minutos |
| **Aguardar Rate Limit** | 1-2 minutos |
| **Deploy Cloud Run** | 2-3 minutos |

**Total (pior caso):** ~10 minutos

---

## 🚨 Problemas Mais Comuns

### 1. Variável Não Configurada (60% dos casos)

**Sintomas:**
- `configured: false`
- Erro 503
- `GROQ_API_KEY not configured`

**Solução:** [Solução 1](#solução-1-configurar-variável)

---

### 2. Chave Inválida/Expirada (25% dos casos)

**Sintomas:**
- `configured: true`
- Erro 500
- `isAuthError: true`
- `401 Unauthorized`

**Solução:** [Solução 2](#solução-2-chave-inválida)

---

### 3. Rate Limit (10% dos casos)

**Sintomas:**
- Erro 500
- `isRateLimitError: true`
- `429 Too Many Requests`

**Solução:** [Solução 3](#solução-3-rate-limit)

---

### 4. Erro de Rede (5% dos casos)

**Sintomas:**
- Erro 500
- `isNetworkError: true`
- `ECONNREFUSED` ou `ETIMEDOUT`

**Solução:** [Solução 4](#solução-4-erro-de-rede)

---

## 📱 Comandos Úteis em Um Só Lugar

```bash
# Verificar status
curl https://sisrua-app-244319582382.southamerica-east1.run.app/health | jq '.groqApiKey'

# Testar funcionalidade
curl -X POST https://sisrua-app-244319582382.southamerica-east1.run.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"stats": {"buildings": 10}, "locationName": "Test"}' | jq

# Ver logs de inicialização
gcloud logging read "jsonPayload.hasGroqApiKey" --limit 5 --format json | jq

# Ver logs de erro
gcloud logging read "jsonPayload.isAuthError OR jsonPayload.isRateLimitError" \
  --limit 10 --format json | jq

# Configurar variável
gcloud run services update sisrua-app \
  --update-env-vars GROQ_API_KEY=sua_chave \
  --region southamerica-east1

# Testar chave diretamente
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"

# Verificar configuração atual
gcloud run services describe sisrua-app \
  --region southamerica-east1 \
  --format='get(spec.template.spec.containers[0].env)'
```

---

## 🔗 Links Importantes

- **Console Groq:** https://console.groq.com/
- **API Keys:** https://console.groq.com/keys
- **Documentação:** https://console.groq.com/docs
- **Status:** https://status.groq.com/
- **Cloud Run Console:** https://console.cloud.google.com/run

---

## ✅ Checklist Rápido

- [ ] Health check mostra `configured: true`
- [ ] Health check mostra `length: 56`
- [ ] Health check mostra `prefix: "gsk_"`
- [ ] Teste retorna `{"analysis": "..."}`
- [ ] Logs mostram `hasGroqApiKey: true`
- [ ] Logs NÃO mostram `isAuthError: true`
- [ ] Logs NÃO mostram `isRateLimitError: true`

**Se todos marcados:** ✅ Tudo funcionando!

---

**Tempo total de troubleshooting:** < 5 minutos

**Última atualização:** 2026-02-18
