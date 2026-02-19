# 🗺️ Guia de Navegação - Domínio Personalizado

## 🎯 Qual documento devo ler?

### Iniciando: Quero entender se vale a pena
👉 **[ANTES_E_DEPOIS_DOMINIO.md](ANTES_E_DEPOIS_DOMINIO.md)**
- Comparação visual antes/depois
- Cenários de uso real
- ROI e benefícios
- Tempo: 5 minutos de leitura

---

### Decidindo: Qual opção escolher?
👉 **[DOMINIO_PERSONALIZADO_RESUMO.md](DOMINIO_PERSONALIZADO_RESUMO.md)**
- Tabela comparativa de opções
- Resumo de custos
- FAQ rápido
- Decisão em 5 minutos

---

### Implementando: Como fazer passo a passo?
👉 **[CUSTOM_DOMAIN_SETUP.md](CUSTOM_DOMAIN_SETUP.md)**
- Guia completo e detalhado
- Instruções passo a passo
- Console + CLI
- Troubleshooting
- Exemplos completos

---

### Fazendo deploy: Como integrar com deployment?
👉 **[GUIA_DEPLOY.md](GUIA_DEPLOY.md#-domínio-personalizado-opcional)**
- Seção de domínio personalizado
- Integração com workflow
- Atualização de variáveis

---

## 📊 Fluxo Recomendado de Leitura

```
1. Está curioso?
   ↓
   ANTES_E_DEPOIS_DOMINIO.md (5 min)
   ↓
   
2. Quer saber as opções?
   ↓
   DOMINIO_PERSONALIZADO_RESUMO.md (5 min)
   ↓
   
3. Decidiu fazer?
   ↓
   CUSTOM_DOMAIN_SETUP.md (30 min)
   ↓
   
4. Implementar e deployar!
   ↓
   Seguir os passos do guia
```

---

## 🚀 Quick Start (Se já decidiu)

**Já tem domínio ou vai comprar um:**

1. Registrar domínio (se não tem)
   - [Registro.br](https://registro.br) - R$ 40/ano (.br)
   
2. Seguir CUSTOM_DOMAIN_SETUP.md
   - Seção: "Opção 1: Configurar Domínio Próprio"
   - 4 passos simples
   
3. Aguardar propagação DNS (1-2h)

4. Pronto! ✅

**Quer opção 100% grátis:**

1. Criar conta em [DuckDNS](https://www.duckdns.org)

2. Seguir CUSTOM_DOMAIN_SETUP.md
   - Seção: "Opção 2: Configurar Subdomínio Gratuito"
   
3. Configurar proxy (se necessário)

4. Pronto! ✅

---

## 📚 Conteúdo de Cada Documento

### ANTES_E_DEPOIS_DOMINIO.md
```
📄 Tamanho: 247 linhas
⏱️ Leitura: 5 minutos
🎯 Propósito: Convencer e mostrar benefícios

Conteúdo:
- ❌ URL feio vs ✅ URL bonito
- Cenários reais (email, cartão, apresentação)
- Impacto em SEO e marketing
- ROI detalhado
- Tempo de setup
```

### DOMINIO_PERSONALIZADO_RESUMO.md
```
📄 Tamanho: 181 linhas
⏱️ Leitura: 5 minutos
🎯 Propósito: Resumo executivo e decisão

Conteúdo:
- Tabela comparativa de opções
- Setup rápido em 4 passos
- Resumo de custos
- FAQ (10 perguntas comuns)
- Próximos passos
```

### CUSTOM_DOMAIN_SETUP.md
```
📄 Tamanho: 541 linhas
⏱️ Leitura: 30 minutos
🎯 Propósito: Guia técnico completo

Conteúdo:
- Passo 1: Verificar propriedade
- Passo 2: Mapear domínio
- Passo 3: Configurar DNS
- Passo 4: Aguardar propagação
- Passo 5: SSL automático
- Troubleshooting completo
- Configurações avançadas
- Exemplo real passo a passo
```

### GUIA_DEPLOY.md (seção atualizada)
```
📄 Seção adicionada
⏱️ Leitura: 3 minutos
🎯 Propósito: Integração com deploy

Conteúdo:
- Como integrar domínio no workflow
- Comandos rápidos
- Atualização de secrets
- Referência aos guias
```

---

## 💡 Perguntas Frequentes

### "Qual documento leio primeiro?"
👉 Comece com **ANTES_E_DEPOIS_DOMINIO.md** para entender os benefícios

### "Quero fazer rápido, qual o caminho mais curto?"
👉 Leia **DOMINIO_PERSONALIZADO_RESUMO.md** e siga os 4 passos

### "Preciso de todos os detalhes técnicos"
👉 **CUSTOM_DOMAIN_SETUP.md** tem tudo que você precisa

### "Já sei tudo, só quero os comandos"
👉 Vá direto para **CUSTOM_DOMAIN_SETUP.md** → Seção "Passo 2 e 3"

### "Quero opção mais barata"
👉 **DOMINIO_PERSONALIZADO_RESUMO.md** → Opção 2 (grátis)

### "Tenho dúvidas específicas"
👉 **CUSTOM_DOMAIN_SETUP.md** → Seção "Troubleshooting"

---

## 🎓 Recursos Adicionais

### Documentação Oficial Google
- [Cloud Run Custom Domains](https://cloud.google.com/run/docs/mapping-custom-domains)
- [Domain Verification](https://cloud.google.com/dns/docs/verify-domain-ownership)
- [SSL Certificates](https://cloud.google.com/load-balancing/docs/ssl-certificates)

### Ferramentas Úteis
- [DNS Checker](https://dnschecker.org) - Verificar propagação
- [SSL Labs](https://www.ssllabs.com/ssltest/) - Testar SSL
- [Registro.br](https://registro.br) - Registrar domínios .br

### Provedores de Subdomínio Grátis
- [DuckDNS](https://www.duckdns.org) - Recomendado
- [FreeDNS](https://freedns.afraid.org)
- [No-IP](https://www.noip.com/free)
- [EU.org](https://nic.eu.org)

---

## 📞 Suporte

### Problemas Técnicos?
1. Consulte seção **Troubleshooting** em CUSTOM_DOMAIN_SETUP.md
2. Verifique logs: `gcloud run domain-mappings describe`
3. Abra issue: https://github.com/jrlampa/myworld/issues

### Dúvidas sobre Custos?
1. Veja tabela em **DOMINIO_PERSONALIZADO_RESUMO.md**
2. Compare opções em **ANTES_E_DEPOIS_DOMINIO.md**

### Precisa de Ajuda para Decidir?
1. Leia comparação em **DOMINIO_PERSONALIZADO_RESUMO.md**
2. Veja cenários em **ANTES_E_DEPOIS_DOMINIO.md**

---

## ✅ Checklist Rápido

Antes de começar:
- [ ] Li comparação antes/depois
- [ ] Decidi qual opção (próprio vs grátis)
- [ ] Tenho domínio ou vou registrar
- [ ] Tenho acesso ao Google Cloud Console
- [ ] Tenho acesso ao DNS do domínio

Durante setup:
- [ ] Seguindo guia passo a passo
- [ ] Registros DNS configurados
- [ ] Aguardando propagação
- [ ] SSL provisionado

Após setup:
- [ ] Testei acesso via HTTPS
- [ ] Atualizei variáveis de ambiente
- [ ] Documentei novo URL
- [ ] Comuniquei aos usuários

---

## 🎯 Objetivo Final

Transformar isto:
```
https://sisrua-app-244319582382.southamerica-east1.run.app
```

Nisto:
```
https://sisrua.app.br
```

**Custo:** R$ 40/ano (ou R$ 0 com subdomínio grátis)  
**Tempo:** 2 horas (ou 50 minutos)  
**Benefício:** Profissionalismo, credibilidade, facilidade

---

**Bom setup! 🚀**

---

**Última Atualização:** 2026-02-19  
**Versão:** 1.0  
**Navegação:** Este é o documento índice
