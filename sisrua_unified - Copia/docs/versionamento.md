# Versionamento e Release

## Branch de release (alpha)

- Branch dedicada: `release/alpha-release`
- Objetivo: estabilizar e publicar versão alpha no Cloud Run

## Padrão de tags

- Tag alpha: `alpha-release-YYYY.MM.DD.N`
- Exemplo: `alpha-release-2026.02.17.1`

## Fluxo recomendado

1. Merge das mudanças para `release/alpha-release`
2. CI executa build e testes backend
3. Criar tag alpha no commit validado
4. Push da tag para disparar deploy no Cloud Run

## GitHub Actions incluídas

- `CI` em `.github/workflows/ci.yml`
  - `npm ci`
  - `npm run build`
  - `npm run test:backend`

- `Deploy Cloud Run` em `.github/workflows/deploy-cloud-run.yml`
  - Dispara em push na branch `release/alpha-release`
  - Dispara também em tag `alpha-release*`
  - Faz deploy no Cloud Run com `gcloud run deploy --source .`

## Configuração obrigatória no GitHub

### Repository Variables

- `GCP_PROJECT_ID` (ex.: `sisrua-producao`)
- `CLOUD_RUN_REGION` (ex.: `us-central1`)
- `CLOUD_RUN_SERVICE` (ex.: `sisrua-monolito`)

### Repository Secrets

- `GCP_WIF_PROVIDER` (Workload Identity Provider)
- `GCP_SERVICE_ACCOUNT` (Service Account usada no deploy)
- `GROQ_API_KEY`

## Comandos úteis

```bash
git checkout release/alpha-release
git tag -a alpha-release-2026.02.17.1 -m "alpha release"
git push origin release/alpha-release
git push origin alpha-release-2026.02.17.1
```
