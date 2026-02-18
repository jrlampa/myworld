# Workflows de Monitoramento e Health Check

Este documento descreve os workflows de CI/CD para garantir um deploy saudável e verificado.

## 📋 Visão Geral

Implementamos dois workflows principais para monitoramento de deployment:

1. **Post-Deploy Verification** - Verifica o deployment no Cloud Run
2. **Health Check** - Testa todas as funcionalidades da aplicação

---

## 🔍 Workflow 1: Post-Deploy Verification

**Arquivo:** `.github/workflows/post-deploy-check.yml`

### Quando Executa
- ✅ Automaticamente após o workflow "Deploy to Cloud Run" ser concluído com sucesso
- ✅ Manualmente via workflow_dispatch

### O Que Verifica

#### ✅ Deploy no Cloud Run
- Verifica se o serviço `sisrua-app` existe e está pronto
- Checa o status do serviço (deve ser "True")
- Confirma que o deployment foi bem-sucedido

#### ✅ URL do Serviço
- Captura automaticamente a URL do serviço Cloud Run
- Testa se a URL está acessível
- Verifica se o endpoint `/health` responde com HTTP 200

#### ✅ Variáveis de Ambiente
- Valida que todas as variáveis obrigatórias estão configuradas:
  - `NODE_ENV`
  - `GCP_PROJECT`
  - `CLOUD_TASKS_LOCATION`
  - `CLOUD_TASKS_QUEUE`
  - `GROQ_API_KEY` (verifica existência, não valor)
  - `CLOUD_RUN_BASE_URL`

#### ✅ Configuração do Serviço
- Verifica alocação de memória (1024Mi)
- Verifica alocação de CPU (2)
- Verifica configuração de escalonamento (min/max instances)
- Valida timeout e outras configurações

### Como Executar Manualmente

```bash
# Via GitHub CLI
gh workflow run post-deploy-check.yml

# Ou via interface do GitHub
# Actions > Post-Deploy Verification > Run workflow
```

### Exemplo de Saída

```
✅ Cloud Run service is deployed and ready
✅ Service URL is accessible (HTTP 200)
✅ NODE_ENV is set
✅ GCP_PROJECT is set
✅ CLOUD_TASKS_LOCATION is set
✅ CLOUD_TASKS_QUEUE is set
✅ GROQ_API_KEY is set
✅ Service configuration verified

📊 Deployment Verification Summary
- Service: sisrua-app
- Region: southamerica-east1
- Project: sisrua-producao
- URL: https://sisrua-app-xxx-xx.a.run.app
- Status: success

✅ All deployment verification checks passed!
```

---

## 🏥 Workflow 2: Health Check

**Arquivo:** `.github/workflows/health-check.yml`

### Quando Executa
- ✅ Automaticamente após deployment bem-sucedido
- ✅ A cada 6 horas (schedule: `0 */6 * * *`)
- ✅ Manualmente via workflow_dispatch

### O Que Testa

#### ✅ Health Check Endpoint
- **Endpoint:** `GET /health`
- **Esperado:** HTTP 200
- **Verifica:** Serviço está online e respondendo

#### ✅ Frontend Carregando
- **Endpoint:** `GET /`
- **Esperado:** HTTP 200
- **Verifica:** index.html está sendo servido corretamente

#### ✅ API Endpoints Respondendo

##### Search API (Geocoding)
- **Endpoint:** `POST /api/search`
- **Payload:** `{"query": "-23.5505, -46.6333"}`
- **Verifica:** Serviço de geocoding está funcionando

##### AI Analysis API
- **Endpoint:** `POST /api/analyze`
- **Payload:** Stats e locationName
- **Verifica:** Integração com Groq AI está funcional

##### Elevation Profile API
- **Endpoint:** `POST /api/elevation/profile`
- **Payload:** Start, end, steps
- **Verifica:** Serviço de elevação está carregando dados

#### ✅ Geração DXF Funcionando
- **Endpoint:** `POST /api/dxf`
- **Payload:** Lat, lon, radius, mode
- **Esperado:** HTTP 202 (Accepted) ou 200 (dev mode)
- **Verifica:** Sistema de geração DXF está operacional

#### ✅ Cloud Tasks Processando
- Cria um job de DXF
- Captura o Job ID da resposta
- Consulta status do job via `GET /api/jobs/:id`
- **Verifica:** Sistema de job tracking está funcionando

#### ✅ Static Assets
- **Endpoint:** `GET /theme-override.css`
- **Verifica:** Assets estáticos estão sendo servidos

#### ✅ API Documentation
- **Endpoint:** `GET /api-docs/`
- **Verifica:** Swagger UI está acessível

#### ✅ Cleanup de Arquivos
- Verificado indiretamente pela operação normal do serviço
- DXF cleanup service roda automaticamente a cada 2 minutos
- Arquivos são deletados após 10 minutos

### Script de Health Check

O workflow também executa um script Node.js abrangente:

**Arquivo:** `.github/scripts/health-check.js`

Este script testa todos os endpoints de forma programática e fornece um relatório detalhado:

```
🏥 Health Check for: https://sisrua-app-xxx.a.run.app
================================================

📋 Basic Health Checks
----------------------
✅ Health Check Endpoint: OK (145ms, HTTP 200)
✅ Frontend (index.html): OK (234ms, HTTP 200)

📋 API Endpoints
----------------------
✅ Search API (geocoding): OK (456ms, HTTP 200)
✅ AI Analysis API: OK (1234ms, HTTP 200)
✅ Elevation Profile API: OK (567ms, HTTP 200)
✅ DXF Generation API: OK (189ms, HTTP 202)

📋 Static Assets
----------------------
✅ Theme CSS: OK (123ms, HTTP 200)

📋 Documentation
----------------------
✅ Swagger API Docs: OK (234ms, HTTP 200)

================================================
📊 Health Check Summary
================================================
✅ Passed: 8
❌ Failed: 0
📈 Total:  8
📊 Success Rate: 100%
================================================

✅ All health checks passed!
```

### Como Executar Manualmente

#### Via GitHub Actions
```bash
# Via GitHub CLI
gh workflow run health-check.yml

# Com URL customizada
gh workflow run health-check.yml -f service_url=https://your-service-url.com
```

#### Localmente (para desenvolvimento)
```bash
# Usando o script diretamente
node .github/scripts/health-check.js https://your-service-url.com

# Ou via variável de ambiente
export SERVICE_URL=https://your-service-url.com
node .github/scripts/health-check.js
```

---

## 🔄 Fluxo Completo de Deploy

```
┌─────────────────────────────────────────────────────────────┐
│  1. Push para main/production/release/alpha-release         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Pre-Deploy Checks                                        │
│     - Valida arquivos                                        │
│     - Valida secrets                                         │
│     - Build TypeScript                                       │
│     - Build Frontend                                         │
│     - Build Docker                                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Deploy to Cloud Run                                      │
│     - Autentica no GCP                                       │
│     - Deploy do serviço                                      │
│     - Captura URL do serviço                                 │
│     - Atualiza env vars                                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Post-Deploy Verification (automático)                    │
│     ✅ Verifica deploy no Cloud Run                         │
│     ✅ Checa URL do serviço                                 │
│     ✅ Valida variáveis de ambiente                         │
│     ✅ Verifica configuração                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Health Check (automático)                                │
│     ✅ Health endpoint respondendo                          │
│     ✅ Frontend carregando                                  │
│     ✅ APIs respondendo                                     │
│     ✅ DXF generation funcionando                           │
│     ✅ AI analysis funcional                                │
│     ✅ Elevação carregando                                  │
│     ✅ Cloud Tasks processando                              │
│     ✅ Assets acessíveis                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Monitoramento Contínuo

### Health Check Programado

O workflow de Health Check roda automaticamente:
- **Frequência:** A cada 6 horas
- **Cron:** `0 */6 * * *` (00:00, 06:00, 12:00, 18:00 UTC)
- **Propósito:** Detectar degradação de serviço

### Notificações

Os workflows vão falhar se qualquer check não passar, o que irá:
1. Enviar notificação via GitHub (se configurado)
2. Aparecer como falha na aba Actions
3. Pode ser integrado com Slack/Discord/Email via webhooks

---

## 🔧 Troubleshooting

### Workflow Falha: "Service not ready"

**Possível causa:** Deploy ainda em andamento

**Solução:**
```bash
# Verificar status do serviço
gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao

# Verificar logs
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Health Check Falha: Timeout

**Possível causa:** Cold start do Cloud Run

**Solução:** 
- Os workflows já incluem 10s de warm-up
- Considere aumentar `min-instances` se necessário

### Environment Variables Missing

**Possível causa:** Secrets não configurados no GitHub

**Solução:**
```bash
# Verificar secrets necessários
gh secret list

# Adicionar secret faltante
gh secret set SECRET_NAME
```

---

## 🎯 Próximos Passos

### Melhorias Sugeridas

1. **Alertas Proativos**
   - Integrar com Slack/Discord
   - Configurar PagerDuty para falhas críticas

2. **Métricas Avançadas**
   - Adicionar tempo de resposta aos checks
   - Monitorar taxa de sucesso ao longo do tempo

3. **Testes de Carga**
   - Adicionar workflow para load testing
   - Verificar performance sob stress

4. **Rollback Automático**
   - Implementar rollback se health check falhar
   - Usar deployment strategies (blue-green, canary)

---

## 📚 Referências

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Workflow Triggers](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)

---

**Última Atualização:** 18 de Fevereiro de 2026
**Versão:** 1.0.0
