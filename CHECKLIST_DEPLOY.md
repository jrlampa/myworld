# ✅ Checklist - Deploy Cloud Run do Zero

**Use esta checklist para garantir que todos os passos foram executados**

---

## PRÉ-DEPLOY

### Verificar Secrets do GitHub
Acesse: https://github.com/jrlampa/myworld/settings/secrets/actions

- [ ] `GCP_WIF_PROVIDER` existe
- [ ] `GCP_SERVICE_ACCOUNT` existe  
- [ ] `GCP_PROJECT_ID` existe
- [ ] `GCP_PROJECT` existe
- [ ] `GROQ_API_KEY` existe
- [ ] `CLOUD_RUN_BASE_URL` existe (será atualizado automaticamente)

Se algum estiver faltando, veja `DEPLOY_DO_ZERO.md` seção "Configurar Secrets"

---

## DEPLOY

### Escolher Método de Deploy

**Opção A - GitHub Actions (Recomendado)**
- [ ] Acessar https://github.com/jrlampa/myworld/actions
- [ ] Clicar em "Deploy to Cloud Run"
- [ ] Clicar em "Run workflow"
- [ ] Selecionar branch `main`
- [ ] Clicar em "Run workflow" (botão verde)
- [ ] Aguardar 5-10 minutos

**OU Opção B - Push Automático**
- [ ] `git commit --allow-empty -m "chore: redeploy from scratch"`
- [ ] `git push origin main`
- [ ] Aguardar workflow executar automaticamente

**OU Opção C - gcloud CLI**
- [ ] Ver comandos em `DEPLOY_DO_ZERO.md` seção "Opção C"

---

## PÓS-DEPLOY (OBRIGATÓRIO)

### Configurar Permissões IAM

⚠️ **ESTE PASSO É OBRIGATÓRIO** - Sem ele, a geração de DXF não funcionará!

```bash
# Copie e cole todos estes comandos:

PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")

gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

- [ ] Comandos IAM executados com sucesso
- [ ] Aguardar 1-2 minutos para propagação

---

## VERIFICAÇÃO

### Obter URL do Serviço

```bash
CLOUD_RUN_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format='value(status.url)')

echo "URL do serviço: $CLOUD_RUN_URL"
```

- [ ] URL obtida com sucesso
- [ ] Anotar URL: `___________________________________`

### Testar Health Check

```bash
# Substituir <URL> pela URL obtida acima
curl <URL>/health
```

- [ ] Retorna `{"status":"healthy",...}`

### Testar API de Busca

```bash
curl "<URL>/api/search?query=São%20Paulo"
```

- [ ] Retorna resultados de busca

### Testar API de DXF

```bash
curl -X POST <URL>/api/dxf \
  -H "Content-Type: application/json" \
  -d '{"lat":-23.55052,"lon":-46.63331,"radius":500,"mode":"local"}'
```

- [ ] Retorna `{"taskId":"...","status":"queued",...}`

### Verificar Recursos no GCP

```bash
# Cloud Run service
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao

# Cloud Tasks queue
gcloud tasks queues describe sisrua-queue \
  --location=southamerica-east1 \
  --project=sisrua-producao
```

- [ ] Serviço Cloud Run está `Ready`
- [ ] Fila Cloud Tasks existe

### Verificar Logs

```bash
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --limit=50
```

- [ ] Sem erros críticos nos logs
- [ ] Aplicação iniciou corretamente

---

## ATUALIZAR DOCUMENTAÇÃO

### Atualizar Secret CLOUD_RUN_BASE_URL (Opcional)

A URL já foi configurada automaticamente como variável de ambiente no Cloud Run.
Opcionalmente, você pode atualizar o secret do GitHub também:

- [ ] Copiar URL do serviço
- [ ] Acessar https://github.com/jrlampa/myworld/settings/secrets/actions
- [ ] Atualizar `CLOUD_RUN_BASE_URL` com a nova URL
- [ ] Salvar

---

## MONITORAMENTO (Primeiras 24h)

### Acessar Cloud Console

URL: https://console.cloud.google.com/run/detail/southamerica-east1/sisrua-app

- [ ] Verificar métricas de CPU
- [ ] Verificar uso de memória
- [ ] Verificar latência (p95, p99)
- [ ] Verificar taxa de erros

### Configurar Alertas (Recomendado)

- [ ] Alerta para taxa de erro > 5%
- [ ] Alerta para latência p95 > 5s
- [ ] Alerta para uso de memória > 80%

---

## ✅ DEPLOY COMPLETO!

Se todos os itens acima estão marcados:

- ✅ Deploy executado com sucesso
- ✅ Permissões IAM configuradas
- ✅ Serviço respondendo corretamente
- ✅ APIs funcionando
- ✅ Monitoramento configurado

**Próximos passos:**
- Testar funcionalidades principais
- Validar em ambiente de produção
- Comunicar equipe sobre novo deploy

---

## 🆘 EM CASO DE PROBLEMAS

Consulte a seção **Troubleshooting** em `DEPLOY_DO_ZERO.md`

Problemas comuns:
- Deploy falha com "Service not found" → Normal na primeira vez
- "Permission denied" → Verificar secrets do GitHub
- Geração de DXF falha → Executar comandos IAM (Passo obrigatório)
- Container não inicia → Verificar logs

---

**Data do Deploy**: ___/___/______  
**Responsável**: _________________  
**URL do Serviço**: _________________________________
