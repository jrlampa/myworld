# 🌐 Domínio Personalizado - Resposta Rápida

## ✅ SIM! Você pode usar um domínio personalizado sem custos adicionais!

### 📊 Comparação de Opções

| Opção | URL Final | Custo | Profissional | Setup |
|-------|-----------|-------|-------------|-------|
| **Cloud Run Padrão** | `sisrua-app-244319582382.southamerica-east1.run.app` | 💵 GRÁTIS | ❌ Feio | ✅ Automático |
| **Domínio Próprio** | `sisrua.app.br` ou `app.sisrua.com.br` | 💵 ~R$ 40-60/ano | ✅✅✅ Muito | ⚡ ~1-2 horas |
| **Subdomínio Gratuito** | `sisrua.duckdns.org` ou `sisrua.eu.org` | 💵 GRÁTIS | ⚠️ Médio | ⚡ ~30 min |

---

## 🎯 Recomendação: Domínio Próprio

**Por que?**
- ✅ Profissional e confiável
- ✅ Totalmente personalizável
- ✅ SSL/TLS GRÁTIS (Google-managed)
- ✅ Sem marcas de terceiros
- 💰 Apenas R$ 40-60/ano (~R$ 3,50/mês)

**Onde registrar?**
- [Registro.br](https://registro.br) - Domínios `.br` (R$ 40/ano) ⭐ Recomendado
- [Google Domains](https://domains.google) - Integração facilitada
- [Hostgator Brasil](https://hostgator.com.br) - Vários TLDs

---

## 🚀 Setup Rápido (4 Passos)

### 1️⃣ Registrar Domínio
```
Acesse: https://registro.br
Busque: sisrua.app.br (ou outro disponível)
Registre: R$ 40/ano
Tempo: 5 minutos
```

### 2️⃣ Verificar Propriedade
```bash
gcloud domains verify sisrua.app.br
# Adicionar registro TXT fornecido no DNS
```

### 3️⃣ Mapear no Cloud Run
```bash
gcloud run domain-mappings create \
  --service=sisrua-app \
  --domain=sisrua.app.br \
  --region=southamerica-east1
```

### 4️⃣ Configurar DNS
```
Adicionar registros A no Registro.br:
216.239.32.21
216.239.34.21
216.239.36.21
216.239.38.21

Aguardar: 1-2 horas (propagação DNS)
```

**Pronto!** 🎉 SSL automático e HTTPS funcionando!

---

## 🆓 Alternativa 100% Gratuita

**DuckDNS** (subdomínio grátis):

1. Acesse: https://www.duckdns.org
2. Login com Google/GitHub
3. Crie subdomínio: `sisrua` → `sisrua.duckdns.org`
4. ⚠️ Limitação: Não suporta CNAME direto para Cloud Run
5. **Solução**: Use Cloudflare (grátis) como proxy

**Melhor opção gratuita**: Registrar domínio `.eu.org` (grátis, mas processo manual)

---

## 💰 Resumo de Custos

### Cloud Run
| Item | Custo |
|------|-------|
| Domain Mapping | **R$ 0** ✅ GRÁTIS |
| SSL/TLS Certificate | **R$ 0** ✅ GRÁTIS |
| Renovação automática | **R$ 0** ✅ GRÁTIS |
| Unlimited domains | **R$ 0** ✅ GRÁTIS |

### Domínio
| Provedor | TLD | Custo/ano |
|----------|-----|-----------|
| Registro.br | `.br` | R$ 40 |
| Registro.br | `.com.br` | R$ 40 |
| Registro.br | `.app.br` | R$ 40 |
| Google Domains | `.com` | ~R$ 70 |
| DuckDNS | `.duckdns.org` | **R$ 0** ✅ |
| EU.org | `.eu.org` | **R$ 0** ✅ |

**Total Anual**: R$ 40-70 (ou R$ 0 com subdomínio grátis)

---

## 📖 Guia Completo

Para instruções detalhadas passo a passo, veja:

👉 **[CUSTOM_DOMAIN_SETUP.md](CUSTOM_DOMAIN_SETUP.md)**

Inclui:
- ✅ Verificação de domínio
- ✅ Mapeamento no Cloud Run
- ✅ Configuração DNS completa
- ✅ Troubleshooting
- ✅ Múltiplos domínios
- ✅ Exemplos práticos

---

## 🔧 Comandos Úteis

```bash
# Listar domínios mapeados
gcloud run domain-mappings list --region=southamerica-east1

# Verificar status do certificado SSL
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

**Q: O mapeamento de domínio tem custo?**  
A: NÃO! É 100% grátis no Cloud Run.

**Q: O certificado SSL tem custo?**  
A: NÃO! Google fornece e renova automaticamente, grátis.

**Q: Quanto tempo leva para configurar?**  
A: 1-2 horas (principalmente aguardando propagação DNS)

**Q: Posso usar múltiplos domínios?**  
A: SIM! Pode mapear quantos quiser, todos grátis.

**Q: Preciso renovar o certificado SSL?**  
A: NÃO! Google renova automaticamente antes de expirar.

**Q: Posso usar subdomínio (app.sisrua.com.br)?**  
A: SIM! Funciona perfeitamente, só usar CNAME no DNS.

**Q: Tenho que pagar algo no Cloud Run?**  
A: NÃO para domínio/SSL. Você só paga pelo uso da aplicação (compute time).

---

## ✅ Próximos Passos

1. **Decidir**: Domínio próprio ou subdomínio grátis?
2. **Registrar**: Se domínio próprio, registrar em Registro.br
3. **Seguir**: Guia completo em [CUSTOM_DOMAIN_SETUP.md](CUSTOM_DOMAIN_SETUP.md)
4. **Testar**: Verificar acesso via HTTPS
5. **Compartilhar**: URL bonito com os usuários! 🎉

---

**Documentação**: [CUSTOM_DOMAIN_SETUP.md](CUSTOM_DOMAIN_SETUP.md)  
**Deploy**: [GUIA_DEPLOY.md](GUIA_DEPLOY.md)  
**Atualizado**: 2026-02-19
