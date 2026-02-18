# 🚀 Workflows de Deploy e Monitoramento - Resumo Rápido

## ✅ Workflows Implementados

### 1️⃣ Post-Deploy Verification (`post-deploy-check.yml`)
**Executa após cada deploy bem-sucedido**

Verifica:
- ✅ Deploy no Cloud Run está funcionando
- ✅ URL do serviço está acessível  
- ✅ Variáveis de ambiente estão configuradas
- ✅ Configuração do serviço está correta

**Execução:** Automática após deploy + Manual

---

### 2️⃣ Health Check (`health-check.yml`)
**Testa todas as funcionalidades da aplicação**

Verifica:
- ✅ Health endpoint respondendo (`/health`)
- ✅ Frontend carregando (index.html)
- ✅ API endpoints respondendo
  - Search (geocoding)
  - Analyze (AI com Groq)
  - Elevation Profile
  - DXF Generation
- ✅ Cloud Tasks processando jobs
- ✅ Static assets (CSS, docs)
- ✅ API Documentation (Swagger)

**Execução:** Automática (após deploy + a cada 6h) + Manual

---

## 🎯 Como Usar

### Executar Health Check Manualmente

```bash
# Via GitHub CLI
gh workflow run health-check.yml

# Via GitHub web interface
# Actions → Health Check → Run workflow
```

### Executar Post-Deploy Check Manualmente

```bash
# Via GitHub CLI
gh workflow run post-deploy-check.yml
```

### Executar Script de Health Check Localmente

```bash
# Diretamente
node .github/scripts/health-check.js https://your-service-url.com

# Via variável de ambiente
export SERVICE_URL=https://your-service-url.com
node .github/scripts/health-check.js
```

---

## 📊 Fluxo de Deploy Completo

```
1. Push → 2. Pre-Deploy → 3. Deploy → 4. Post-Deploy Check → 5. Health Check
   ↓           ↓              ↓              ↓                    ↓
  Code      Validate       Cloud Run     Verify Deploy      Test All Features
           Build          Production     Configuration       End-to-End
```

---

## 🔍 O Que Cada Workflow Faz

| Workflow | Quando | O Que Testa | Tempo |
|----------|--------|-------------|-------|
| **Pre-Deploy** | Antes do deploy | Build, Docker, Secrets | ~3-5min |
| **Deploy** | Push para main/prod | Deploy no Cloud Run | ~5-8min |
| **Post-Deploy** | Após deploy | Cloud Run config | ~1-2min |
| **Health Check** | Após deploy + 6/6h | Todas funcionalidades | ~2-3min |

---

## ✅ Checklist de Deploy Saudável

Após um deploy, verifique:

- [ ] ✅ Pre-Deploy passou (build OK)
- [ ] ✅ Deploy passou (Cloud Run OK)
- [ ] ✅ Post-Deploy passou (config OK)
- [ ] ✅ Health Check passou (app OK)

Se todos passaram: **🎉 Deploy Saudável!**

---

## 🆘 Se Algo Falhar

1. **Check GitHub Actions tab**
   - Veja qual step falhou
   - Leia os logs detalhados

2. **Verificar Cloud Run**
   ```bash
   gcloud run services describe sisrua-app \
     --region=southamerica-east1
   ```

3. **Ver logs em tempo real**
   ```bash
   gcloud run services logs read sisrua-app \
     --region=southamerica-east1 \
     --follow
   ```

4. **Testar endpoints manualmente**
   ```bash
   curl https://your-service-url.com/health
   ```

---

## 📚 Documentação Completa

Para mais detalhes, consulte:
- **[MONITORING_WORKFLOWS.md](.github/MONITORING_WORKFLOWS.md)** - Documentação completa dos workflows

---

## 🔧 Arquivos Criados

```
.github/
├── workflows/
│   ├── post-deploy-check.yml    # Verifica deploy no Cloud Run
│   └── health-check.yml          # Testa todas funcionalidades
├── scripts/
│   └── health-check.js           # Script Node.js para testes
└── MONITORING_WORKFLOWS.md       # Documentação detalhada
```

---

**Status:** ✅ Workflows implementados e prontos para uso!
**Versão:** 1.0.0
**Data:** 18 de Fevereiro de 2026
