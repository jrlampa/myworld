# GROQ Integration Guide

This document covers the GROQ AI integration in SIS RUA for automated OSM data analysis.

## Overview

SIS RUA uses GROQ's LLaMA 3.3 70B model to provide AI-powered analysis of OpenStreetMap data in Portuguese (Brazilian Portuguese).

## Getting an API Key

1. Go to https://console.groq.com/keys
2. Create a free account
3. Generate an API key (starts with `gsk_`)
4. The key is approximately 56 characters long

## Configuration

### Local Development

Add to `sisrua_unified/.env`:
```bash
GROQ_API_KEY=gsk_your_key_here
```

### Cloud Run Production

```bash
gcloud run services update sisrua-app \
  --update-env-vars GROQ_API_KEY=gsk_your_key_here \
  --region southamerica-east1
```

### GitHub Actions Secret

```bash
gh secret set GROQ_API_KEY --body="gsk_your_key_here" --repo jrlampa/myworld
```

## Verification

### Health Check

```bash
curl https://sisrua-app-244319582382.southamerica-east1.run.app/health | jq '.groqApiKey'
```

| Result | Status | Action |
|--------|--------|--------|
| `configured: true` | ✅ OK | Key is configured |
| `configured: false` | ❌ Error | Configure the key |

### Test Analysis

```bash
curl -X POST https://sisrua-app-244319582382.southamerica-east1.run.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"stats": {"buildings": 10}, "locationName": "Test"}' | jq
```

| Response | Status | Action |
|----------|--------|--------|
| `{"analysis": "..."}` | ✅ OK | Working correctly |
| `{"error": "GROQ_API_KEY not configured"}` | ❌ 503 | Configure the key |
| `{"analysis": "**Erro de Autenticação**"}` | ❌ 500 | Invalid key |
| `{"analysis": "**Limite de Taxa**"}` | ⚠️ 500 | Rate limit hit |

## Quick Diagnosis (3 Steps)

### Step 1: Health Check (15 seconds)

```bash
curl https://sisrua-app-244319582382.southamerica-east1.run.app/health | jq '.groqApiKey'
```

### Step 2: Test Functionality (15 seconds)

```bash
curl -X POST https://sisrua-app-244319582382.southamerica-east1.run.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"stats": {"buildings": 10}, "locationName": "Test"}' | jq
```

### Step 3: Check Logs (30 seconds)

```bash
gcloud logging read "resource.labels.service_name=sisrua-app AND \
  (jsonPayload.hasGroqApiKey OR jsonPayload.isAuthError OR jsonPayload.isRateLimitError)" \
  --limit 5 --format json | jq '.[].jsonPayload'
```

## Troubleshooting

### Problem: GROQ_API_KEY Not Configured

**Symptoms:**
- Health shows `configured: false`
- API returns HTTP 503 with `"GROQ_API_KEY not configured"`
- UI shows: "Análise AI Indisponível"

**Fix:**
```bash
gcloud run services update sisrua-app \
  --update-env-vars GROQ_API_KEY=gsk_sua_chave_aqui \
  --region southamerica-east1
```

### Problem: Invalid API Key (Authentication Error)

**Symptoms:**
- Health shows `configured: true` but wrong length/prefix
- API returns HTTP 500 with auth error
- Log shows `isAuthError: true`

**Fix:** Generate a new key at https://console.groq.com/keys

**Verify key format:**
- Must start with `gsk_`
- Must be ~56 characters long

### Problem: Rate Limit Exceeded

**Symptoms:**
- Log shows `isRateLimitError: true`
- Intermittent 500 errors

**Fix:**
- Wait 1-2 minutes (GROQ rate limits reset quickly)
- GROQ free tier has generous limits for typical usage

### Problem: Network Error

**Symptoms:**
- Log shows `isNetworkError: true`
- Intermittent failures

**Fix:**
- Usually transient — retry automatically
- Check Cloud Run instance health
- Verify outbound internet access from Cloud Run

## Production Logs

```bash
# Check server startup (verify key is detected)
gcloud logging read "jsonPayload.message='Server starting with environment configuration'" \
  --limit 5 --format json | jq '.[] | .jsonPayload'

# Check analysis requests
gcloud logging read "jsonPayload.message='GROQ API analysis requested'" \
  --limit 10 --format json | jq '.[] | .jsonPayload'
```

**Log fields:**
- `hasGroqApiKey: true` — Key is present
- `groqKeyLength: 56` — Key has correct length
- `groqKeyPrefix: "gsk_xxx"` — Correct prefix
- `isAuthError: true` — Invalid key
- `isRateLimitError: true` — Rate limit hit
- `isNetworkError: true` — Network failure

## Error Messages (Portuguese)

When GROQ is unavailable, users see helpful messages:

**No API key:**
```
**Análise AI Indisponível**
Configure GROQ_API_KEY para habilitar análises inteligentes.
Obtenha sua chave gratuita em: https://console.groq.com/keys
```

**Connection error:**
```
**Erro de conexão**: Não foi possível contatar o servidor de análise.
Verifique se o backend está em execução na porta 3001.
```

**Authentication error:**
```
**Erro de Autenticação**: A chave GROQ_API_KEY é inválida.
Verifique a chave em: https://console.groq.com/keys
```

## Model Configuration

- **Model**: LLaMA 3.3 70B
- **Language**: Portuguese (Brazilian Portuguese)
- **Error handling**: Graceful degradation — app continues working without AI analysis
- **Timeout**: 30 seconds (configurable)
