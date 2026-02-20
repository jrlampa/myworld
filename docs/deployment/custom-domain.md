# Custom Domain Setup

Replace the default Cloud Run URL (`https://sisrua-app-244319582382.southamerica-east1.run.app`) with a custom domain.

## Options

| Option | URL Example | Cost | Setup Time |
|--------|-------------|------|------------|
| Own domain | `https://sisrua.app.br` | ~R$ 40/year | ~2 hours |
| Free subdomain | `https://sisrua.duckdns.org` | Free | ~30 minutes |
| Default Cloud Run URL | `https://sisrua-app-xxx.run.app` | Free | None |

> **Note**: Domain mapping and SSL/TLS certificates are **free** on Cloud Run — you only pay for the domain registration itself.

## Benefits of a Custom Domain

- ✅ Professional and memorable URL
- ✅ SSL/TLS certificate managed automatically by Google
- ✅ Better for sharing, marketing, and branding
- ✅ No additional infrastructure cost

## Option 1: Own Domain (Recommended)

### Step 1: Register a Domain

Recommended Brazilian registrars:
- [Registro.br](https://registro.br) — `.br` domains (~R$ 40/year)
- [Google Domains](https://domains.google)
- [Hostgator Brasil](https://hostgator.com.br)

### Step 2: Verify Domain Ownership

```bash
gcloud domains verify sisrua.app.br
# This opens a browser to complete verification
# You'll need to add a TXT record in your DNS provider
```

### Step 3: Map Domain to Cloud Run

```bash
gcloud run domain-mappings create \
  --service=sisrua-app \
  --domain=sisrua.app.br \
  --region=southamerica-east1
```

### Step 4: Configure DNS Records

After mapping, Google provides DNS records. Add these A records at your domain registrar:

```
216.239.32.21
216.239.34.21
216.239.36.21
216.239.38.21
```

Wait 1–2 hours for DNS propagation. SSL certificate is provisioned automatically.

### Step 5: Verify

```bash
curl https://sisrua.app.br/health
```

## Option 2: Free Subdomain (DuckDNS)

1. Go to [duckdns.org](https://www.duckdns.org)
2. Sign in with Google or GitHub
3. Create a subdomain: `sisrua` → `sisrua.duckdns.org`
4. Note: DuckDNS doesn't support CNAME directly to Cloud Run; use Cloudflare (free) as a proxy.

**Better free option**: Register a `.eu.org` domain (free, but requires manual process).

## Integration with GitHub Actions

After setting up a custom domain, update the `CLOUD_RUN_BASE_URL` secret:

```bash
gh secret set CLOUD_RUN_BASE_URL --body="https://sisrua.app.br" --repo jrlampa/myworld
```

Also update the Cloud Run service environment variable:

```bash
gcloud run services update sisrua-app \
  --region=southamerica-east1 \
  --update-env-vars="CLOUD_RUN_BASE_URL=https://sisrua.app.br" \
  --project=sisrua-producao
```

## Troubleshooting

### SSL Certificate Not Provisioned

SSL certificates are provisioned automatically but can take up to 15 minutes. Verify DNS records are correct:

```bash
dig sisrua.app.br
# Should return the Google IP addresses
```

### Domain Verification Failed

Ensure the TXT record was added correctly and has propagated:

```bash
dig TXT sisrua.app.br
```

### Domain Mapping Not Found

Check if the mapping exists:

```bash
gcloud run domain-mappings list --region=southamerica-east1
```

## ROI Comparison

| Aspect | Default URL | Custom Domain |
|--------|-------------|---------------|
| Memorability | ❌ Long, complex | ✅ Short, memorable |
| Professionalism | ❌ Looks temporary | ✅ Looks professional |
| Sharing | ❌ Hard to type | ✅ Easy to share |
| Cost | Free | ~R$ 3.50/month |
| SEO | ❌ No branding | ✅ Branded URL |
