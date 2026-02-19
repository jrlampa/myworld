# 🌐 Configuração de Domínio Personalizado - SIS RUA

## 🎯 Resposta Direta

**Pergunta**: "consigo usar outro endereço além desse feioso 'https://sisrua-app-244319582382.southamerica-east1.run.app', sem custos?"

**Resposta**: **SIM! ✅**

Você pode usar um domínio personalizado como `https://sisrua.app.br` com:
- ✅ Mapeamento de domínio **GRÁTIS** no Cloud Run
- ✅ Certificado SSL/TLS **GRÁTIS** (gerenciado pelo Google)
- ✅ Renovação automática **GRÁTIS**
- 💰 Único custo: ~R$ 40/ano (registro do domínio) - **OPCIONAL**
- 🆓 Alternativa 100% grátis: Usar subdomínio grátis (DuckDNS, EU.org)

---

## 📚 Documentação Disponível

Criamos **5 documentos completos** para ajudar você:

### 🗺️ 1. Comece Aqui - Índice de Navegação
**[INDICE_DOMINIO_PERSONALIZADO.md](INDICE_DOMINIO_PERSONALIZADO.md)**
- Qual documento ler primeiro?
- Fluxo de leitura recomendado
- Guia de navegação
- ⏱️ 2 minutos

### 🔄 2. Vale a Pena? - Antes e Depois
**[ANTES_E_DEPOIS_DOMINIO.md](ANTES_E_DEPOIS_DOMINIO.md)**
- Comparação visual
- Cenários reais (email, cartão de visita, apresentações)
- ROI detalhado
- Benefícios profissionais
- ⏱️ 5 minutos

### 📋 3. Resumo Executivo - Decisão Rápida
**[DOMINIO_PERSONALIZADO_RESUMO.md](DOMINIO_PERSONALIZADO_RESUMO.md)**
- Tabela comparativa de opções
- Setup em 4 passos
- FAQ (perguntas frequentes)
- Custos e benefícios
- ⏱️ 5 minutos

### 📖 4. Guia Completo - Implementação Técnica
**[CUSTOM_DOMAIN_SETUP.md](CUSTOM_DOMAIN_SETUP.md)**
- Passo a passo detalhado
- Verificação de domínio
- Mapeamento no Cloud Run
- Configuração DNS
- SSL/TLS automático
- Troubleshooting completo
- ⏱️ 30 minutos

### 🚀 5. Integração - Deploy
**[GUIA_DEPLOY.md](GUIA_DEPLOY.md#-domínio-personalizado-opcional)**
- Como integrar no workflow
- Atualização de variáveis
- Comandos rápidos
- ⏱️ 3 minutos

---

## ⚡ Quick Start

### Opção Recomendada: Domínio Próprio

```bash
# 1. Registrar domínio (R$ 40/ano)
# Exemplo: sisrua.app.br em https://registro.br

# 2. Verificar propriedade
gcloud domains verify sisrua.app.br
# Adicionar registro TXT no DNS

# 3. Mapear no Cloud Run
gcloud run domain-mappings create \
  --service=sisrua-app \
  --domain=sisrua.app.br \
  --region=southamerica-east1

# 4. Configurar DNS
# Adicionar registros A fornecidos pelo Google
# Aguardar propagação (1-2 horas)

# 5. Pronto! SSL automático 🎉
curl https://sisrua.app.br/health
```

### Opção Gratuita: Subdomínio

```bash
# 1. Criar conta em https://www.duckdns.org
# 2. Criar subdomínio: sisrua.duckdns.org
# 3. Seguir guia de subdomínio grátis
# 4. Configurar proxy (se necessário)
```

---

## 💰 Resumo de Custos

### Cloud Run (TUDO GRÁTIS!)
| Item | Custo |
|------|-------|
| Mapeamento de domínio | R$ 0 ✅ |
| Certificado SSL/TLS | R$ 0 ✅ |
| Renovação automática | R$ 0 ✅ |
| Domínios ilimitados | R$ 0 ✅ |

### Domínio
| Opção | Custo/ano |
|-------|-----------|
| Domínio .br (Registro.br) | R$ 40 |
| Domínio .com.br | R$ 40 |
| Domínio .app.br | R$ 40 |
| Subdomínio grátis (DuckDNS) | R$ 0 ✅ |
| Subdomínio grátis (EU.org) | R$ 0 ✅ |

**Total**: R$ 40/ano (ou R$ 0 com subdomínio grátis)

---

## 📊 Comparação: Antes vs Depois

### ❌ Antes (URL Padrão)
```
https://sisrua-app-244319582382.southamerica-east1.run.app
```
- Longo e difícil de lembrar
- Não profissional
- Difícil de compartilhar
- Aparência temporária

### ✅ Depois (Domínio Personalizado)
```
https://sisrua.app.br
```
- Curto e memorável
- Profissional
- Fácil de compartilhar
- Marca forte

---

## 🎯 Qual Opção Escolher?

### Escolha Domínio Próprio se:
- ✅ Quer aparência profissional
- ✅ Tem orçamento de R$ 40/ano
- ✅ Quer total controle
- ✅ Planeja crescer o projeto

### Escolha Subdomínio Grátis se:
- ✅ Quer testar primeiro
- ✅ Orçamento zero
- ✅ Projeto pessoal/hobby
- ✅ Não precisa de marca própria

---

## ✅ Próximos Passos

1. **Decidir**: Domínio próprio ou subdomínio grátis?
2. **Ler**: Começar pelo [Índice de Navegação](INDICE_DOMINIO_PERSONALIZADO.md)
3. **Implementar**: Seguir o [Guia Completo](CUSTOM_DOMAIN_SETUP.md)
4. **Testar**: Verificar acesso via HTTPS
5. **Compartilhar**: Usar seu novo URL profissional! 🎉

---

## 🛠️ Comandos Úteis

```bash
# Listar domínios mapeados
gcloud run domain-mappings list --region=southamerica-east1

# Verificar status do SSL
gcloud run domain-mappings describe sisrua.app.br \
  --region=southamerica-east1

# Remover mapeamento
gcloud run domain-mappings delete sisrua.app.br \
  --region=southamerica-east1

# Testar domínio
curl https://sisrua.app.br/health
```

---

## ❓ FAQ Rápido

**Q: Tem custo no Cloud Run?**  
A: NÃO! Mapeamento e SSL são 100% grátis.

**Q: Quanto tempo leva?**  
A: 1-2 horas (principalmente propagação DNS).

**Q: Preciso renovar certificado?**  
A: NÃO! Google renova automaticamente.

**Q: Posso ter múltiplos domínios?**  
A: SIM! Todos grátis.

**Q: E se não tiver domínio?**  
A: Use subdomínio grátis (DuckDNS, EU.org).

[Ver mais perguntas →](DOMINIO_PERSONALIZADO_RESUMO.md#-faq-rápido)

---

## 📞 Suporte

### Problemas?
1. Consulte [Troubleshooting](CUSTOM_DOMAIN_SETUP.md#%EF%B8%8F-troubleshooting)
2. Verifique logs: `gcloud run domain-mappings describe`
3. Abra issue: https://github.com/jrlampa/myworld/issues

---

## 📖 Índice Completo

- **[INDICE_DOMINIO_PERSONALIZADO.md](INDICE_DOMINIO_PERSONALIZADO.md)** - Navegação e índice
- **[ANTES_E_DEPOIS_DOMINIO.md](ANTES_E_DEPOIS_DOMINIO.md)** - Comparação visual e ROI
- **[DOMINIO_PERSONALIZADO_RESUMO.md](DOMINIO_PERSONALIZADO_RESUMO.md)** - Resumo executivo
- **[CUSTOM_DOMAIN_SETUP.md](CUSTOM_DOMAIN_SETUP.md)** - Guia técnico completo
- **[GUIA_DEPLOY.md](GUIA_DEPLOY.md)** - Integração com deploy

---

## 🎓 Recursos Adicionais

- [Cloud Run Custom Domains - Google](https://cloud.google.com/run/docs/mapping-custom-domains)
- [Registro.br](https://registro.br) - Registrar domínios .br
- [DuckDNS](https://www.duckdns.org) - Subdomínios grátis
- [DNS Checker](https://dnschecker.org) - Verificar propagação
- [SSL Labs](https://www.ssllabs.com/ssltest/) - Testar SSL

---

**Última Atualização:** 2026-02-19  
**Versão:** 1.0  
**Status:** ✅ Documentação Completa

**Começar agora:** [INDICE_DOMINIO_PERSONALIZADO.md](INDICE_DOMINIO_PERSONALIZADO.md)
