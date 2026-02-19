# ✅ Deploy do Zero - Resumo de Implementação

**Data**: 19 de fevereiro de 2026  
**Tarefa**: Configurar deploy do Cloud Run do zero após deletar o serviço

---

## 🎯 O que foi feito

Preparei tudo para você fazer o deploy do Cloud Run do zero, **reutilizando os secrets já configurados no GitHub**.

---

## 📚 Documentação Criada

### 1. README_DEPLOY_ZERO.md ⭐ **COMECE AQUI**
- Guia rápido de referência
- Links para todos os outros guias
- Comandos essenciais resumidos
- 3 passos principais para deploy

### 2. DEPLOY_DO_ZERO.md 📖 **GUIA COMPLETO**
- Passo a passo detalhado
- O que você já tem vs. o que precisa recriar
- 3 métodos de deploy (GitHub Actions, git push, gcloud CLI)
- Como configurar permissões IAM (OBRIGATÓRIO)
- Como verificar que tudo funcionou
- Como configurar secrets (caso necessário)

### 3. CHECKLIST_DEPLOY.md ✓ **CHECKLIST INTERATIVA**
- Lista de verificação passo a passo
- Marque cada item conforme completar
- Comandos prontos para copiar/colar
- Verificações de sucesso

### 4. TROUBLESHOOTING_DEPLOY_ZERO.md 🔧 **SOLUÇÃO DE PROBLEMAS**
- Todos os erros comuns explicados
- Causas e soluções detalhadas
- Comandos de diagnóstico
- Comandos úteis para debug

---

## 🔧 Mudanças no Código

### .github/workflows/pre-deploy.yml
**O que mudou**: Secret `CLOUD_RUN_BASE_URL` agora é opcional

**Por quê**: No primeiro deploy, este secret ainda não existe (será criado automaticamente). Antes, o workflow falhava por causa disso.

**Linha alterada**:
```bash
# ANTES (causava erro):
[ -n "$CLOUD_RUN_BASE_URL" ] || (echo "Missing secret: CLOUD_RUN_BASE_URL" && exit 1)

# DEPOIS (permite primeiro deploy):
[ -n "$CLOUD_RUN_BASE_URL" ] || echo "Note: CLOUD_RUN_BASE_URL not set yet (will be set on first deploy)"
```

---

## ✅ O que você JÁ TEM (pode reutilizar)

### GitHub Secrets
Verifique em: https://github.com/jrlampa/myworld/settings/secrets/actions

- ✅ `GCP_WIF_PROVIDER` - Workload Identity Provider
- ✅ `GCP_SERVICE_ACCOUNT` - Email da service account
- ✅ `GCP_PROJECT_ID` - ID do projeto (ex: `sisrua-producao`)
- ✅ `GCP_PROJECT` - Nome do projeto (ex: `sisrua-producao`)
- ✅ `GROQ_API_KEY` - API key do GROQ
- ⚠️ `CLOUD_RUN_BASE_URL` - Opcional (será atualizado automaticamente)

### Infraestrutura GCP
- ✅ Workload Identity Federation configurado
- ✅ Service Account com permissões básicas
- ✅ APIs habilitadas (serão revalidadas no deploy)

### GitHub Actions
- ✅ Workflows configurados e prontos
- ✅ Pre-deploy checks
- ✅ Post-deploy verification
- ✅ Health checks

---

## ❌ O que foi DELETADO (será recriado)

### Automaticamente pelo Workflow
- ❌ Serviço Cloud Run `sisrua-app` → Criado no deploy
- ❌ Fila Cloud Tasks `sisrua-queue` → Criada no deploy

### Manualmente por Você (OBRIGATÓRIO)
- ⚠️ **Permissões IAM específicas do serviço** → Você precisa configurar após deploy

---

## 🚀 PRÓXIMOS PASSOS (O que você precisa fazer)

### Passo 1: Escolher Método de Deploy

**Opção A - GitHub Actions UI (Mais Fácil)** ⭐ RECOMENDADO
1. Acessar: https://github.com/jrlampa/myworld/actions
2. Clicar em "Deploy to Cloud Run"
3. Clicar em "Run workflow"
4. Selecionar branch `main`
5. Clicar no botão verde "Run workflow"
6. Aguardar 5-10 minutos

**Opção B - Push para Main**
```bash
git commit --allow-empty -m "chore: redeploy Cloud Run from scratch"
git push origin main
```

**Opção C - gcloud CLI**
```bash
cd sisrua_unified
gcloud run deploy sisrua-app --source=. --region=southamerica-east1 ...
```
(Ver comandos completos em `DEPLOY_DO_ZERO.md`)

### Passo 2: Configurar Permissões IAM (OBRIGATÓRIO!)

⚠️ **IMPORTANTE**: Sem este passo, a geração de DXF não funcionará!

Após o deploy completar com sucesso, execute:

```bash
# 1. Descobrir número do projeto
PROJECT_NUMBER=$(gcloud projects describe sisrua-producao --format="value(projectNumber)")

# 2. Dar permissão para criar tarefas no Cloud Tasks
gcloud projects add-iam-policy-binding sisrua-producao \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

# 3. Dar permissão para Cloud Tasks invocar o webhook
gcloud run services add-iam-policy-binding sisrua-app \
  --region=southamerica-east1 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=sisrua-producao
```

### Passo 3: Testar o Serviço

```bash
# Obter URL do serviço
CLOUD_RUN_URL=$(gcloud run services describe sisrua-app \
  --region=southamerica-east1 \
  --project=sisrua-producao \
  --format='value(status.url)')

echo "URL do serviço: $CLOUD_RUN_URL"

# Testar health check
curl ${CLOUD_RUN_URL}/health

# Testar busca
curl "${CLOUD_RUN_URL}/api/search?query=São%20Paulo"

# Testar geração de DXF
curl -X POST ${CLOUD_RUN_URL}/api/dxf \
  -H "Content-Type: application/json" \
  -d '{"lat":-23.55052,"lon":-46.63331,"radius":500,"mode":"local"}'
```

---

## 📋 Checklist Rápida

Use `CHECKLIST_DEPLOY.md` para uma versão detalhada e interativa!

- [ ] Verificar secrets do GitHub existem
- [ ] Trigger deploy (GitHub Actions ou git push)
- [ ] Aguardar workflow completar (5-10 min)
- [ ] **Executar comandos IAM** (obrigatório!)
- [ ] Obter URL do serviço
- [ ] Testar health check
- [ ] Testar API de busca
- [ ] Testar API de DXF
- [ ] Verificar logs (sem erros)
- [ ] Atualizar `CLOUD_RUN_BASE_URL` secret (opcional)

---

## 🆘 Em Caso de Problemas

### Problema Comum #1: Deploy falha com erro de secret

**Solução**: Faça `git pull` da branch atual - já foi corrigido!

### Problema Comum #2: "Service not found"

**Solução**: Normal na primeira vez! O workflow cria o serviço automaticamente.

### Problema Comum #3: Geração de DXF retorna 403 Forbidden

**Solução**: Execute os comandos IAM do Passo 2 (obrigatório!).

### Outros Problemas

Consulte: **`TROUBLESHOOTING_DEPLOY_ZERO.md`**

---

## 📖 Guia de Leitura Recomendada

### Para Deploy Rápido (10 minutos)
1. Leia `README_DEPLOY_ZERO.md`
2. Use `CHECKLIST_DEPLOY.md` como guia
3. Se der erro, consulte `TROUBLESHOOTING_DEPLOY_ZERO.md`

### Para Deploy Completo (30 minutos)
1. Leia `DEPLOY_DO_ZERO.md` completo
2. Siga todos os passos detalhados
3. Faça todas as verificações recomendadas

---

## 🎓 Informações Técnicas

### Por que preciso configurar permissões IAM manualmente?

Quando você deleta o serviço Cloud Run, as permissões específicas do serviço são perdidas. O GitHub Actions **não tem** permissão para modificar IAM policies (por segurança), então você precisa fazer isso manualmente.

### O que essas permissões fazem?

1. **`roles/cloudtasks.enqueuer`**: Permite o app criar tarefas no Cloud Tasks para processamento assíncrono de DXF
2. **`roles/run.invoker`**: Permite Cloud Tasks chamar o webhook do Cloud Run para processar as tarefas

### Isso precisa ser feito toda vez?

**Não!** Apenas na primeira vez após deletar o serviço. Deploy subsequentes mantêm as permissões.

---

## ✅ Resultado Esperado

Após seguir todos os passos:

- ✅ Serviço Cloud Run rodando em `https://sisrua-app-*.southamerica-east1.run.app`
- ✅ Fila Cloud Tasks `sisrua-queue` criada
- ✅ Health check respondendo com status 200
- ✅ API de busca funcionando
- ✅ Geração de DXF funcionando (modo assíncrono)
- ✅ Logs sem erros críticos
- ✅ Métricas normais (CPU < 50%, memória < 80%)

---

## 📞 Suporte

1. **Documentação**: Comece por `README_DEPLOY_ZERO.md`
2. **Problemas**: Consulte `TROUBLESHOOTING_DEPLOY_ZERO.md`
3. **Logs**: https://github.com/jrlampa/myworld/actions
4. **GCP Console**: https://console.cloud.google.com/run

---

## 🎉 Está Tudo Pronto!

Você agora tem:
- ✅ Documentação completa em português
- ✅ Guias passo a passo
- ✅ Comandos prontos para usar
- ✅ Solução de todos os problemas comuns
- ✅ Workflow corrigido para permitir primeiro deploy
- ✅ Checklist interativa

**Próxima ação**: Abra `README_DEPLOY_ZERO.md` e siga as instruções!

---

**Criado por**: GitHub Copilot Agent  
**Data**: 19 de fevereiro de 2026  
**Status**: ✅ Completo e pronto para uso
