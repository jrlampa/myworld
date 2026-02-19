# 🌐 Guia de Configuração de Domínio Personalizado para Cloud Run

## 📋 Visão Geral

Este guia ensina como substituir o URL padrão do Cloud Run (`https://sisrua-app-244319582382.southamerica-east1.run.app`) por um domínio personalizado, **SEM CUSTOS ADICIONAIS** (apenas o custo do domínio).

**Benefícios:**
- ✅ URL profissional e memorável (ex: `sisrua.com.br`)
- ✅ SSL/TLS GRÁTIS (certificado gerenciado automaticamente pelo Google)
- ✅ Mapeamento de domínio GRÁTIS no Cloud Run
- ✅ Renovação automática de certificados
- ✅ Configuração simples e rápida

---

## 💰 Opções Disponíveis

### Opção 1: Domínio Próprio (Recomendado) 💎

**Custo**: ~R$ 40-60/ano (apenas o registro do domínio)

**Provedores Recomendados no Brasil:**
- [Registro.br](https://registro.br) - Domínios `.br` (R$ 40/ano)
- [Hostgator](https://hostgator.com.br) - Vários TLDs
- [Locaweb](https://locaweb.com.br) - Domínios + DNS
- [Google Domains](https://domains.google) - Integração facilitada

**Vantagens:**
- Total controle sobre o domínio
- Profissional e confiável
- Integração perfeita com Google Cloud
- Certificado SSL automático e gratuito

### Opção 2: Subdomínio Gratuito 🆓

**Custo**: R$ 0 (totalmente grátis)

**Serviços Disponíveis:**
- [DuckDNS](https://www.duckdns.org) - `seu-app.duckdns.org`
- [FreeDNS](https://freedns.afraid.org) - Vários domínios disponíveis
- [No-IP](https://www.noip.com/free) - `seu-app.ddns.net`
- [EU.org](https://nic.eu.org) - `seu-app.eu.org`

**Limitações:**
- Menos profissional
- Marca de terceiros no domínio
- Algumas limitações de configuração
- Pode ter restrições de disponibilidade

---

## 🚀 Opção 1: Configurar Domínio Próprio

### Passo 1: Verificar Propriedade do Domínio

Antes de mapear o domínio, você precisa verificar que é o proprietário:

#### Via Console do Google Cloud

1. Acesse o **Cloud Console**: https://console.cloud.google.com
2. Vá para **Cloud Run** → Selecione seu serviço (`sisrua-app`)
3. Clique na aba **"Domínios"** ou **"Domain Mappings"**
4. Clique em **"Adicionar Mapeamento"** ou **"Add Mapping"**
5. Selecione **"Verificar um novo domínio"**
6. Digite seu domínio (ex: `sisrua.com.br`)
7. Siga as instruções para adicionar um registro TXT no DNS

#### Via gcloud CLI

```bash
# 1. Verificar propriedade do domínio
gcloud domains verify sisrua.com.br

# Isso abrirá um navegador para completar a verificação
# Você precisará adicionar um registro TXT no seu provedor DNS
```

**Registro TXT de Verificação:**

O Google fornecerá um registro TXT como este:
```
Nome: @ (ou raiz do domínio)
Tipo: TXT
Valor: google-site-verification=AbCdEf123456...
TTL: 3600
```

Adicione este registro no painel DNS do seu provedor (Registro.br, Hostgator, etc.)

### Passo 2: Mapear o Domínio no Cloud Run

#### Via Console do Google Cloud

1. Retorne para **Cloud Run** → **sisrua-app** → **Domínios**
2. Clique em **"Adicionar Mapeamento"**
3. Selecione o domínio verificado
4. Escolha:
   - **Domínio raiz**: `sisrua.com.br`
   - **Subdomínio**: `app.sisrua.com.br` ou `www.sisrua.com.br`
5. Clique em **"Continuar"**
6. O Google fornecerá registros DNS para configurar

#### Via gcloud CLI

```bash
# Mapear domínio raiz
gcloud run domain-mappings create \
  --service=sisrua-app \
  --domain=sisrua.com.br \
  --region=southamerica-east1 \
  --project=sisrua-producao

# OU mapear subdomínio
gcloud run domain-mappings create \
  --service=sisrua-app \
  --domain=app.sisrua.com.br \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### Passo 3: Configurar Registros DNS

Após mapear, o Google fornecerá os registros DNS necessários. Configure-os no seu provedor:

#### Para Domínio Raiz (`sisrua.com.br`)

```
Tipo: A
Nome: @
Valor: 216.239.32.21
TTL: 3600

Tipo: A
Nome: @
Valor: 216.239.34.21
TTL: 3600

Tipo: A
Nome: @
Valor: 216.239.36.21
TTL: 3600

Tipo: A
Nome: @
Valor: 216.239.38.21
TTL: 3600

Tipo: AAAA
Nome: @
Valor: 2001:4860:4802:32::15
TTL: 3600

Tipo: AAAA
Nome: @
Valor: 2001:4860:4802:34::15
TTL: 3600

Tipo: AAAA
Nome: @
Valor: 2001:4860:4802:36::15
TTL: 3600

Tipo: AAAA
Nome: @
Valor: 2001:4860:4802:38::15
TTL: 3600
```

#### Para Subdomínio (`app.sisrua.com.br` ou `www.sisrua.com.br`)

```
Tipo: CNAME
Nome: app (ou www)
Valor: ghs.googlehosted.com
TTL: 3600
```

**Nota Importante**: Os IPs podem variar. Sempre use os registros fornecidos pelo Google Cloud Console.

### Passo 4: Aguardar Propagação DNS

- **Tempo de propagação**: 5 minutos a 48 horas (normalmente 1-2 horas)
- **Verificar propagação**: Use ferramentas como:
  - https://dnschecker.org
  - https://www.whatsmydns.net
  - Comando: `nslookup sisrua.com.br`

```bash
# Verificar se o DNS está propagado
nslookup sisrua.com.br

# Deve retornar os IPs do Google
```

### Passo 5: Certificado SSL (Automático e Grátis!)

O Google Cloud Run provisiona e renova automaticamente certificados SSL/TLS via **Google-managed SSL certificates**.

**Sem ação necessária!** Após a propagação DNS:
- Certificado é emitido automaticamente (pode levar até 15 minutos)
- HTTPS habilitado automaticamente
- Renovação automática antes do vencimento

Verificar status do certificado:

```bash
gcloud run domain-mappings describe sisrua.com.br \
  --region=southamerica-east1 \
  --platform=managed
```

### Passo 6: Verificação Final

Teste seu novo domínio:

```bash
# Health check
curl https://sisrua.com.br/health

# Verificar certificado SSL
curl -vI https://sisrua.com.br

# Teste de busca
curl https://sisrua.com.br/api/search?query=São%20Paulo
```

---

## 🆓 Opção 2: Configurar Subdomínio Gratuito (DuckDNS)

Se você não quiser comprar um domínio, pode usar um serviço gratuito como **DuckDNS**.

### Passo 1: Criar Conta no DuckDNS

1. Acesse: https://www.duckdns.org
2. Faça login com Google/GitHub
3. Crie um subdomínio (ex: `sisrua.duckdns.org`)
4. Anote seu **token**

### Passo 2: Configurar CNAME no DuckDNS

No painel do DuckDNS:

1. Digite o subdomínio desejado (ex: `sisrua`)
2. No campo **current ip**, deixe vazio
3. Clique em **"add domain"**

### Passo 3: Apontar para Cloud Run

Infelizmente, **DuckDNS não suporta registros CNAME diretamente** para Cloud Run.

**Solução alternativa**: Use **Cloudflare DNS (Grátis)** como proxy:

1. Crie conta em https://cloudflare.com (grátis)
2. Adicione seu domínio DuckDNS ou use um domínio próprio
3. Configure CNAME apontando para `ghs.googlehosted.com`
4. Habilite SSL/TLS no Cloudflare (grátis)

**Nota**: Para subdomínios gratuitos, a melhor opção ainda é ter um domínio próprio (muito baixo custo).

---

## 🔧 Configurações Avançadas

### Redirecionar www para domínio raiz (ou vice-versa)

```bash
# Mapear ambos os domínios
gcloud run domain-mappings create \
  --service=sisrua-app \
  --domain=sisrua.com.br \
  --region=southamerica-east1

gcloud run domain-mappings create \
  --service=sisrua-app \
  --domain=www.sisrua.com.br \
  --region=southamerica-east1
```

Depois, configure no DNS:
- `sisrua.com.br` → Registros A (conforme Passo 3)
- `www.sisrua.com.br` → CNAME para `ghs.googlehosted.com`

### Múltiplos Domínios/Subdomínios

Você pode mapear múltiplos domínios para o mesmo serviço:

```bash
gcloud run domain-mappings create --service=sisrua-app --domain=sisrua.com.br --region=southamerica-east1
gcloud run domain-mappings create --service=sisrua-app --domain=app.sisrua.com.br --region=southamerica-east1
gcloud run domain-mappings create --service=sisrua-app --domain=api.sisrua.com.br --region=southamerica-east1
```

### Remover Mapeamento de Domínio

```bash
# Listar mapeamentos existentes
gcloud run domain-mappings list --region=southamerica-east1

# Remover mapeamento
gcloud run domain-mappings delete sisrua.com.br \
  --region=southamerica-east1
```

---

## 🛠️ Troubleshooting

### Problema: "Domain verification failed"

**Causa**: Registro TXT não foi adicionado ou ainda não propagou

**Solução**:
1. Verificar se o registro TXT está correto no DNS
2. Aguardar propagação (até 48h)
3. Tentar novamente a verificação

```bash
# Verificar registro TXT
dig TXT sisrua.com.br

# Deve mostrar: google-site-verification=...
```

### Problema: "Certificate provisioning failed"

**Causa**: DNS não está apontando corretamente para Cloud Run

**Solução**:
1. Verificar registros A/AAAA ou CNAME
2. Confirmar que DNS propagou globalmente
3. Aguardar até 15 minutos para provisionamento

```bash
# Verificar status do certificado
gcloud run domain-mappings describe sisrua.com.br \
  --region=southamerica-east1 \
  --format="get(status.conditions)"
```

### Problema: "ERR_SSL_VERSION_OR_CIPHER_MISMATCH"

**Causa**: Certificado ainda não foi provisionado

**Solução**: Aguardar propagação DNS completa (pode levar até 24h em casos raros)

### Problema: Acesso via HTTP (não HTTPS)

**Causa**: Cloud Run força HTTPS por padrão

**Solução**: Sempre use `https://` no URL. Cloud Run redireciona HTTP→HTTPS automaticamente.

### Problema: Domínio já está em uso

**Causa**: Domínio já mapeado em outro serviço Cloud Run

**Solução**:
1. Remover mapeamento antigo
2. Aguardar alguns minutos
3. Mapear novamente

---

## 📊 Monitoramento e Logs

### Verificar Status do Mapeamento

```bash
# Listar todos os mapeamentos
gcloud run domain-mappings list \
  --region=southamerica-east1

# Detalhes de um mapeamento específico
gcloud run domain-mappings describe sisrua.com.br \
  --region=southamerica-east1
```

### Logs de Acesso

```bash
# Ver logs do serviço via domínio customizado
gcloud run services logs read sisrua-app \
  --region=southamerica-east1 \
  --limit=50
```

---

## 💰 Resumo de Custos

### Cloud Run - Domain Mapping
- **Custo**: R$ 0 (GRÁTIS)
- Sem limite de domínios mapeados

### SSL/TLS Certificate
- **Custo**: R$ 0 (GRÁTIS)
- Google-managed
- Renovação automática

### Domínio Próprio
- **Custo**: ~R$ 40-60/ano
- Depende do registrador e TLD (.br, .com, etc.)

### Total Estimado
- **Com domínio próprio**: ~R$ 40-60/ano
- **Com subdomínio grátis**: R$ 0

---

## 🎯 Exemplo Completo (Passo a Passo)

Vamos mapear `sisrua.app.br` (exemplo):

### 1. Registrar domínio em Registro.br

```bash
# Via site: https://registro.br
# Custo: R$ 40/ano
# Tempo: ~5 minutos
```

### 2. Verificar propriedade

```bash
gcloud domains verify sisrua.app.br
# Adicionar registro TXT fornecido no DNS
```

### 3. Mapear no Cloud Run

```bash
gcloud run domain-mappings create \
  --service=sisrua-app \
  --domain=sisrua.app.br \
  --region=southamerica-east1 \
  --project=sisrua-producao
```

### 4. Configurar DNS no Registro.br

Adicionar registros A:
```
216.239.32.21
216.239.34.21
216.239.36.21
216.239.38.21
```

### 5. Aguardar propagação (1-2 horas)

```bash
# Verificar propagação
nslookup sisrua.app.br
```

### 6. Testar

```bash
curl https://sisrua.app.br/health
```

**Pronto!** 🎉

---

## 🔄 Atualizar Deployment Workflow

Após configurar o domínio customizado, atualize as variáveis de ambiente:

### No GitHub Secrets

Atualize o secret `CLOUD_RUN_BASE_URL`:

```bash
# Via GitHub CLI
gh secret set CLOUD_RUN_BASE_URL \
  --body="https://sisrua.app.br" \
  --repo jrlampa/myworld
```

### No Cloud Run Service

```bash
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --update-env-vars="CLOUD_RUN_BASE_URL=https://sisrua.app.br"
```

---

## 📚 Referências

### Documentação Oficial
- [Cloud Run Custom Domains](https://cloud.google.com/run/docs/mapping-custom-domains)
- [DNS Configuration](https://cloud.google.com/dns/docs)
- [SSL Certificates](https://cloud.google.com/load-balancing/docs/ssl-certificates)

### Ferramentas Úteis
- [DNS Checker](https://dnschecker.org) - Verificar propagação DNS
- [SSL Labs](https://www.ssllabs.com/ssltest/) - Testar certificado SSL
- [Google Domains](https://domains.google) - Registrar domínios

---

## ✅ Checklist de Configuração

### Pré-requisitos
- [ ] Ter um domínio registrado (ou criar subdomínio grátis)
- [ ] Acesso ao painel DNS do provedor
- [ ] Permissões no Google Cloud Console

### Configuração
- [ ] Verificar propriedade do domínio (registro TXT)
- [ ] Mapear domínio no Cloud Run
- [ ] Configurar registros DNS (A/AAAA ou CNAME)
- [ ] Aguardar propagação DNS (1-48h)
- [ ] Verificar certificado SSL provisionado

### Pós-Configuração
- [ ] Testar acesso via HTTPS
- [ ] Atualizar variável CLOUD_RUN_BASE_URL
- [ ] Atualizar documentação do projeto
- [ ] Comunicar novo URL aos usuários
- [ ] Configurar redirecionamento (se necessário)

---

## 📞 Suporte

### Em Caso de Problemas

1. Verificar logs de mapeamento: `gcloud run domain-mappings describe`
2. Consultar seção de Troubleshooting acima
3. Verificar propagação DNS: https://dnschecker.org
4. Abrir issue no GitHub: https://github.com/jrlampa/myworld/issues

---

**Última Atualização**: 2026-02-19  
**Versão**: 1.0  
**Autor**: SIS RUA Team
