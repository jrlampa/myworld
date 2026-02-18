# 🔍 Verificação Pós-Deploy - Checklist

## Após o Deploy para Cloud Run

Execute estas verificações para confirmar que todas as correções estão funcionando em produção.

---

## 1️⃣ Health Check - Verificar Status do Serviço

```bash
curl https://sisrua-app-244319582382.southamerica-east1.run.app/health | jq
```

**Resultado Esperado:**
```json
{
  "status": "online",
  "service": "sisRUA Unified Backend",
  "version": "1.2.0",
  "python": "available",     ← ✅ Deve ser "available"
  "environment": "production",
  "dockerized": true
}
```

**Se `"python": "unavailable"`:**
- ❌ Dependências Python não estão instaladas
- Verificar logs do build do Docker
- O Dockerfile deve ter falhado na verificação

---

## 2️⃣ Logs - Verificar CORS Funcionando

```bash
# Verificar logs recentes de CORS
gcloud logging read "resource.type=cloud_run_revision AND \
  resource.labels.service_name=sisrua-app AND \
  jsonPayload.message=~'CORS'" \
  --limit 20 \
  --format json | jq '.[] | {
    time: .timestamp,
    message: .jsonPayload.message,
    origin: .jsonPayload.origin,
    isCloudRun: .jsonPayload.isCloudRun
  }'
```

**Resultado Esperado:**
```json
{
  "time": "2026-02-18T...",
  "message": "CORS request allowed",
  "origin": "https://sisrua-app-244319582382.southamerica-east1.run.app",
  "isCloudRun": true
}
```

**NÃO DEVE MAIS APARECER:**
```json
{
  "message": "CORS request rejected in production"
}
```

---

## 3️⃣ DXF Generation - Testar Via API

```bash
# Testar geração de DXF
curl -X POST https://sisrua-app-244319582382.southamerica-east1.run.app/api/dxf \
  -H "Content-Type: application/json" \
  -H "Origin: https://sisrua-app-244319582382.southamerica-east1.run.app" \
  -d '{
    "lat": -22.15018,
    "lon": -42.92189,
    "radius": 500,
    "mode": "circle",
    "projection": "local"
  }' | jq
```

**Resultado Esperado (Produção com Cloud Tasks):**
```json
{
  "status": "queued",
  "jobId": "uuid-aqui"
}
```

**OU (Desenvolvimento):**
```json
{
  "status": "success",
  "url": "https://.../downloads/dxf_123456.dxf",
  "message": "DXF generated immediately in development mode"
}
```

**NÃO DEVE RETORNAR:**
```json
{
  "error": "Not allowed by CORS"
}
```

---

## 4️⃣ Elevation API - Testar Validação

```bash
# Testar endpoint de elevação
curl -X POST https://sisrua-app-244319582382.southamerica-east1.run.app/api/elevation/profile \
  -H "Content-Type: application/json" \
  -d '{
    "start": {"lat": -22.15018, "lng": -42.92189},
    "end": {"lat": -22.15118, "lng": -42.92289},
    "steps": 25
  }' | jq
```

**Resultado Esperado:**
```json
{
  "profile": [
    {"dist": 0, "elev": 100},
    {"dist": 50, "elev": 102},
    ...
  ]
}
```

**Teste com Dados Inválidos:**
```bash
# Sem lat/lng
curl -X POST https://sisrua-app-244319582382.southamerica-east1.run.app/api/elevation/profile \
  -H "Content-Type: application/json" \
  -d '{
    "start": {"invalid": "data"},
    "end": {"lat": -22, "lng": -42}
  }' | jq
```

**Deve Retornar Erro Claro:**
```json
{
  "error": "Invalid start coordinate",
  "details": "Start coordinate must be an object with lat and lng properties"
}
```

---

## 5️⃣ GROQ API - Verificar Configuração

**Com GROQ_API_KEY configurada:**
```bash
curl -X POST https://sisrua-app-244319582382.southamerica-east1.run.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "stats": {"buildings": 10, "roads": 5, "trees": 20},
    "locationName": "Test Location"
  }' | jq
```

**Resultado Esperado:**
```json
{
  "analysis": "**Análise Urbana Profissional**\n\n..."
}
```

**Sem GROQ_API_KEY:**
```json
{
  "error": "GROQ_API_KEY not configured",
  "analysis": "**Análise AI Indisponível**\n\nPara habilitar..."
}
```

---

## 6️⃣ Interface Web - Teste Manual

1. Acesse: `https://sisrua-app-244319582382.southamerica-east1.run.app`

2. **Buscar Localização:**
   - Digite uma localização
   - Deve carregar dados OSM
   - ✅ Sem erros de CORS no console do navegador

3. **Gerar DXF:**
   - Clique em "Gerar DXF"
   - Deve mostrar progresso
   - ✅ Arquivo DXF deve ser gerado

4. **Perfil de Elevação:**
   - Desenhe uma linha no mapa
   - Deve mostrar gráfico de elevação
   - ✅ Sem erros 400

5. **Análise GROQ:**
   - Se GROQ_API_KEY configurada
   - Deve mostrar análise AI
   - ✅ Mensagem clara se não configurada

---

## 7️⃣ Monitoramento - Métricas

```bash
# Taxa de erros HTTP 5xx (deve diminuir)
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count" AND resource.labels.service_name="sisrua-app"' \
  --format=json

# Latência das requisições
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_latencies" AND resource.labels.service_name="sisrua-app"' \
  --format=json
```

**Esperado:**
- ✅ Taxa de erro 5xx deve diminuir drasticamente
- ✅ Latência deve permanecer estável
- ✅ Mais requisições bem-sucedidas

---

## 8️⃣ Logs de Erro - Monitorar

```bash
# Monitorar erros em tempo real
gcloud logging tail "resource.type=cloud_run_revision AND \
  resource.labels.service_name=sisrua-app AND \
  severity>=ERROR"
```

**NÃO DEVE MAIS APARECER:**
- ❌ "Not allowed by CORS"
- ❌ "CORS request rejected in production"
- ❌ "DXF Error: Backend generation failed"

**Erros Esperados (se ocorrerem):**
- ⚠️ "GROQ_API_KEY not configured" (se não configurada)
- ⚠️ Timeouts ocasionais de APIs externas (OSM, Open Elevation)

---

## 9️⃣ Variáveis de Ambiente - Verificar

```bash
gcloud run services describe sisrua-app \
  --region southamerica-east1 \
  --format='value(spec.template.spec.containers[0].env)'
```

**Deve Conter:**
```
NODE_ENV=production
PORT=8080
PYTHON_COMMAND=python3
DOCKER_ENV=true
GROQ_API_KEY=gsk_...     ← Se análise AI for usada
GCP_PROJECT=...
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=sisrua-queue
```

**Nota:** `CLOUD_RUN_BASE_URL` é OPCIONAL agora - CORS funciona sem ela!

---

## 🎯 Checklist de Sucesso

Execute e marque cada item:

- [ ] Health check retorna `"python": "available"`
- [ ] Logs mostram "CORS request allowed"
- [ ] Logs NÃO mostram "CORS request rejected"
- [ ] DXF generation retorna `{"status": "queued"}` ou `{"status": "success"}`
- [ ] Elevation API retorna perfil ou erro claro
- [ ] GROQ API funciona ou retorna mensagem clara
- [ ] Interface web carrega sem erros de CORS
- [ ] DXF pode ser gerado pela interface
- [ ] Taxa de erro 5xx diminuiu
- [ ] Nenhum erro crítico nos logs

---

## ❌ Solução de Problemas

### Se CORS ainda falhar:

1. Verificar URL da origem nos logs:
   ```bash
   gcloud logging read "jsonPayload.origin=~'.*'" --limit 10
   ```

2. Verificar se hostname termina com `.run.app`:
   ```bash
   # No log, deve aparecer isCloudRun: true
   ```

3. Se não funcionar, adicionar URL explicitamente:
   ```bash
   gcloud run services update sisrua-app \
     --update-env-vars CLOUD_RUN_BASE_URL=https://sisrua-app-244319582382.southamerica-east1.run.app \
     --region southamerica-east1
   ```

### Se Python não disponível:

1. Verificar logs do build:
   ```bash
   gcloud builds log <BUILD_ID>
   ```

2. Deve conter:
   ```
   ✅ Python dependencies verified
   ```

3. Se falhar, verificar requirements.txt

### Se DXF falhar:

1. Verificar logs específicos:
   ```bash
   gcloud logging read "jsonPayload.message=~'DXF|Python'" --limit 50
   ```

2. Verificar se Python está disponível no health check

3. Verificar permissões do diretório `/app/public/dxf`

---

## 📞 Suporte

Se após seguir este guia ainda houver problemas:

1. Coletar logs completos:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND \
     resource.labels.service_name=sisrua-app AND \
     timestamp>='2026-02-18T00:00:00Z'" \
     --limit 100 --format json > logs.json
   ```

2. Verificar resposta do health check
3. Testar todas as APIs via curl
4. Revisar documentação:
   - `CORRECAO_CORS_CLOUD_RUN.md`
   - `RESUMO_FINAL_COMPLETO.md`

---

**Última atualização:** 2026-02-18
**Versão:** 1.0
