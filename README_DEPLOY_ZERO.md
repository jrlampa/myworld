# 📖 README - Deploy Cloud Run do Zero

**Guia rápido para redeploy após deletar o serviço Cloud Run**

---

## 🎯 Situação

Você deletou o serviço Cloud Run e quer fazer deploy do zero. **Boa notícia**: Você pode reutilizar todos os secrets já configurados no GitHub!

---

## 🚀 Como Fazer Deploy

### Para Usuários Experientes (Quick Start)

1. ✅ Verificar secrets: https://github.com/jrlampa/myworld/settings/secrets/actions
2. ✅ Trigger deploy: https://github.com/jrlampa/myworld/actions → "Deploy to Cloud Run" → "Run workflow"
3. ✅ Aguardar 5-10 minutos
4. ⚠️ **OBRIGATÓRIO**: Configurar permissões IAM (ver checklist)
5. ✅ Testar endpoints

**Checklist completa**: [`CHECKLIST_DEPLOY.md`](CHECKLIST_DEPLOY.md) ⭐

---

### Para Iniciantes ou Primeira Vez

**Leia o guia completo**: [`DEPLOY_DO_ZERO.md`](DEPLOY_DO_ZERO.md) ⭐

Este guia explica:
- ✅ O que você já tem (pode reutilizar)
- ✅ O que precisa ser recriado
- ✅ Passo a passo detalhado
- ✅ Como verificar que funcionou
- ✅ Como configurar permissões IAM

---

## 📋 Documentos Disponíveis

| Documento | Quando Usar |
|-----------|-------------|
| **[DEPLOY_DO_ZERO.md](DEPLOY_DO_ZERO.md)** | Guia completo passo a passo |
| **[CHECKLIST_DEPLOY.md](CHECKLIST_DEPLOY.md)** | Checklist rápida para seguir |
| **[TROUBLESHOOTING_DEPLOY_ZERO.md](TROUBLESHOOTING_DEPLOY_ZERO.md)** | Quando algo der errado |
| [GUIA_DEPLOY.md](GUIA_DEPLOY.md) | Guia geral de deploy (documentação existente) |
| [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) | Como GitHub Actions está configurado |
| [CONFIGURACAO_OIDC.md](CONFIGURACAO_OIDC.md) | Detalhes sobre OIDC e autenticação |

---

## ⚡ Comandos Rápidos

### 1. Trigger Deploy (Opção A - Push)

```bash
git commit --allow-empty -m "chore: redeploy Cloud Run from scratch"
git push origin main
```

### 2. Configurar Permissões IAM (OBRIGATÓRIO após deploy)

```bash
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

### 3. Testar

```bash
# Obter URL
CLOUD_RUN_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format='value(status.url)')

# Health check
curl ${CLOUD_RUN_URL}/health
```

---

## 🆘 Problemas?

Consulte: **[TROUBLESHOOTING_DEPLOY_ZERO.md](TROUBLESHOOTING_DEPLOY_ZERO.md)**

Problemas comuns:
- ❌ "Missing secret: CLOUD_RUN_BASE_URL" → Já corrigido, faça pull
- ❌ "Service not found" → Normal na primeira vez
- ❌ "Permission denied" → Verificar Workload Identity
- ❌ DXF generation falha → Executar comandos IAM

---

## ✅ O que Você JÁ TEM (pode reutilizar)

- ✅ Secrets do GitHub configurados
- ✅ Workload Identity Federation
- ✅ Service Account com permissões
- ✅ Workflows do GitHub Actions
- ✅ Código da aplicação pronto

## ❌ O que Foi Deletado (será recriado automaticamente)

- ❌ Serviço Cloud Run `sisrua-app` → Criado pelo workflow
- ❌ Fila Cloud Tasks `sisrua-queue` → Criada pelo workflow
- ⚠️ Permissões IAM do serviço → **Você precisa configurar manualmente** (passo 2 acima)

---

## 📞 Suporte

1. **Primeiro**: Consulte [`TROUBLESHOOTING_DEPLOY_ZERO.md`](TROUBLESHOOTING_DEPLOY_ZERO.md)
2. **Logs**: Ver em https://github.com/jrlampa/myworld/actions
3. **GCP Console**: https://console.cloud.google.com/run
4. **Issues**: Abrir em https://github.com/jrlampa/myworld/issues

---

## 🎯 Resumo de 3 Passos

```
1. Deploy via GitHub Actions ou git push
   ↓
2. Configurar permissões IAM (comandos acima)
   ↓
3. Testar endpoints (health, search, dxf)
```

**Pronto! ✅**

---

**Criado em**: 19/02/2026  
**Para**: Deploy do zero após deletar serviço Cloud Run  
**Principais Guias**: `DEPLOY_DO_ZERO.md` e `CHECKLIST_DEPLOY.md`
