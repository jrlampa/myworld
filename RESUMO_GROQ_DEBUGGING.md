# 📋 RESUMO EXECUTIVO - Debugging GROQ_API_KEY

## ✅ Solução Implementada para Troubleshooting

### Problema

Mesmo com `GROQ_API_KEY` configurada no Cloud Run, a aplicação retorna erros 500, dificultando o diagnóstico do problema.

---

## 🔧 Melhorias Implementadas

### 1. Logging na Inicialização do Servidor

**O que foi adicionado:**
```typescript
logger.info('Server starting with environment configuration', {
    hasGroqApiKey: !!process.env.GROQ_API_KEY,
    groqKeyLength: process.env.GROQ_API_KEY?.length || 0,
    groqKeyPrefix: process.env.GROQ_API_KEY?.substring(0, 7) || 'NOT_SET'
});
```

**Como usar:**
```bash
gcloud logging read "jsonPayload.message='Server starting with environment configuration'" \
  --limit 5 --format json | jq '.[] | .jsonPayload'
```

**O que verificar:**
- ✅ `hasGroqApiKey: true` - Variável está presente
- ✅ `groqKeyLength: 56` - Tamanho correto
- ✅ `groqKeyPrefix: "gsk_xxx"` - Prefixo correto

---

### 2. Logging Detalhado no Endpoint /api/analyze

**O que foi adicionado:**
```typescript
logger.info('GROQ API analysis requested', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey.length,
    apiKeyPrefix: apiKey.substring(0, 7),
    timestamp: new Date().toISOString()
});
```

**Como usar:**
```bash
gcloud logging read "jsonPayload.message='GROQ API analysis requested'" \
  --limit 10 --format json | jq '.[] | .jsonPayload'
```

---

### 3. Detecção Específica de Tipos de Erro

**Erros Detectados Automaticamente:**

| Tipo | Indicador | Mensagem |
|------|-----------|----------|
| **Auth Error (401)** | `isAuthError: true` | "Erro de Autenticação - Chave inválida" |
| **Rate Limit (429)** | `isRateLimitError: true` | "Limite de Taxa Excedido" |
| **Network Error** | `isNetworkError: true` | "Erro de Conexão" |

**Exemplo de log:**
```json
{
  "error": "401 Unauthorized",
  "isAuthError": true,
  "isRateLimitError": false,
  "isNetworkError": false
}
```

---

### 4. Status no Health Check

**Endpoint:** `GET /health`

**Nova informação incluída:**
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

**Como verificar:**
```bash
curl https://sisrua-app-244319582382.southamerica-east1.run.app/health | jq '.groqApiKey'
```

---

### 5. Mensagens de Erro Específicas em Português

**Antes:**
```json
{
  "error": "Analysis failed",
  "analysis": "Erro na Análise AI"
}
```

**Depois (Rate Limit):**
```json
{
  "error": "Analysis failed",
  "details": "429 rate limit exceeded",
  "analysis": "**Limite de Taxa Excedido**\n\nMuitas requisições à API Groq. Aguarde alguns momentos."
}
```

**Depois (Auth Error):**
```json
{
  "error": "Analysis failed",
  "details": "401 unauthorized",
  "analysis": "**Erro de Autenticação**\n\nA chave GROQ_API_KEY parece estar inválida."
}
```

---

## 📚 Guia de Troubleshooting Criado

**Arquivo:** `TROUBLESHOOTING_GROQ_API_KEY.md`

**Conteúdo:**
- ✅ 12 seções detalhadas
- ✅ Comandos prontos para copiar/colar
- ✅ Checklist de diagnóstico
- ✅ Soluções para problemas comuns
- ✅ Como obter chave Groq
- ✅ Práticas de segurança

---

## 🔍 Como Diagnosticar Problemas

### Passo 1: Verificar Health Check

```bash
curl https://sisrua-app-xxx.run.app/health | jq '.groqApiKey'
```

**Resultado Esperado:**
```json
{
  "configured": true,
  "length": 56,
  "prefix": "gsk_xxx"
}
```

**Problemas:**
- `configured: false` → Variável não configurada
- `length: 0` → Variável vazia
- `prefix: "NOT_SET"` → Sem valor

---

### Passo 2: Verificar Logs de Inicialização

```bash
gcloud logging read "jsonPayload.hasGroqApiKey" --limit 1 --format json | jq
```

**O que procurar:**
```json
{
  "hasGroqApiKey": true,
  "groqKeyLength": 56,
  "groqKeyPrefix": "gsk_xxx"
}
```

---

### Passo 3: Testar o Endpoint

```bash
curl -X POST https://sisrua-app-xxx.run.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"stats": {"buildings": 10}, "locationName": "Test"}'
```

---

### Passo 4: Verificar Logs de Erro

```bash
gcloud logging read "jsonPayload.isAuthError=true OR jsonPayload.isRateLimitError=true" \
  --limit 10 --format json | jq
```

---

## 📊 Cenários Comuns

### Cenário 1: Variável Não Configurada

**Health Check:**
```json
{"configured": false, "length": 0}
```

**Solução:**
```bash
gcloud run services update sisrua-app \
  --update-env-vars GROQ_API_KEY=sua_chave \
  --region southamerica-east1
```

---

### Cenário 2: Chave Inválida

**Logs:**
```json
{"isAuthError": true}
```

**Mensagem ao Usuário:**
```
**Erro de Autenticação**
A chave GROQ_API_KEY parece estar inválida.
Verifique a configuração no Cloud Run.
```

**Solução:**
1. Gerar nova chave: https://console.groq.com/keys
2. Atualizar no Cloud Run
3. Implantar nova revisão

---

### Cenário 3: Rate Limit

**Logs:**
```json
{"isRateLimitError": true}
```

**Mensagem ao Usuário:**
```
**Limite de Taxa Excedido**
Muitas requisições à API Groq.
Aguarde alguns momentos e tente novamente.
```

**Solução:**
- Aguardar
- Fazer upgrade do plano Groq
- Implementar cache

---

### Cenário 4: Erro de Rede

**Logs:**
```json
{"isNetworkError": true}
```

**Mensagem ao Usuário:**
```
**Erro de Conexão**
Não foi possível conectar à API Groq.
Verifique a conectividade de rede.
```

**Solução:**
- Verificar firewall do Cloud Run
- Verificar status da API Groq

---

## ✅ Validações

**Segurança:**
```
✅ CodeQL: 0 vulnerabilities
✅ Apenas prefixo da chave é logado (não valor completo)
✅ Mensagens sanitizadas (max 200 chars)
✅ TypeScript compila sem erros
```

**Funcionalidade:**
```
✅ Logs aparecem na inicialização
✅ Health check mostra status da chave
✅ Erros específicos são detectados
✅ Mensagens em Português
```

---

## 🚀 Próximos Passos

### Para o Usuário

1. **Deploy desta versão**
2. **Verificar health check:**
   ```bash
   curl https://seu-app.run.app/health | jq '.groqApiKey'
   ```
3. **Se `configured: false`:**
   - Configurar variável no Cloud Run
   - Ver `TROUBLESHOOTING_GROQ_API_KEY.md` seção 5
4. **Se `configured: true` mas erro 500:**
   - Ver logs de erro para tipo específico
   - Seguir solução no troubleshooting guide

### Para Diagnóstico Adicional

Se problemas persistirem após seguir o guia:

**Coletar informações:**
```bash
# 1. Health check
curl https://seu-app.run.app/health > health.json

# 2. Logs de inicialização
gcloud logging read "jsonPayload.message='Server starting'" \
  --limit 5 --format json > startup.json

# 3. Logs de erro GROQ
gcloud logging read "jsonPayload.isAuthError OR jsonPayload.isRateLimitError" \
  --limit 10 --format json > errors.json

# 4. Testar chave diretamente
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"
```

---

## 📄 Arquivos Modificados

1. **`server/index.ts`**
   - Logging na inicialização
   - Logging no endpoint /api/analyze
   - Detecção de tipos de erro
   - Status no health check
   - Mensagens específicas

2. **`TROUBLESHOOTING_GROQ_API_KEY.md`**
   - Guia completo de troubleshooting
   - 12 seções
   - Comandos prontos
   - Soluções

---

## 🎯 Resultado Esperado

**Antes:**
```
❌ Erro 500 genérico
❌ Sem informação sobre a chave
❌ Difícil diagnosticar
```

**Depois:**
```
✅ Health check mostra status da chave
✅ Logs detalhados de inicialização
✅ Erros específicos identificados
✅ Mensagens claras em Português
✅ Guia completo de troubleshooting
```

---

**Status:** ✅ COMPLETO
**Segurança:** ✅ 0 vulnerabilities
**Documentação:** ✅ Guia completo criado
**Pronto para Deploy:** ✅ SIM
