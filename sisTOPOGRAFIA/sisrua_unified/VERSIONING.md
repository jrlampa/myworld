# Guia de Versionamento

Este documento descreve como o versionamento funciona no projeto SIS RUA Unified.

## Estratégia de Versionamento

O projeto segue [Semantic Versioning (SemVer)](https://semver.org/) com o formato `MAJOR.MINOR.PATCH`:

- **MAJOR**: Mudanças incompatíveis na API ou funcionalidade
- **MINOR**: Novas funcionalidades compatíveis com versões anteriores
- **PATCH**: Correções de bugs e pequenas melhorias

### Pré-releases e Metadata de Build

Suportamos também:
- Pré-releases: `1.0.0-alpha.1`, `1.0.0-beta.2`, `1.0.0-rc.1`
- Metadata de build: `1.0.0+20260218`, `1.0.0+build.123`

## Fonte Única de Verdade

O arquivo `VERSION` na raiz do projeto é a **fonte única de verdade** para a versão. Todos os outros arquivos são atualizados automaticamente para refletir a versão deste arquivo.

### Arquivos com Versão

A versão é propagada para:

1. **`VERSION`** - Fonte principal (arquivo de texto simples)
2. **`package.json`** - Versão do pacote Node.js
3. **`package-lock.json`** - Lockfile do npm
4. **`py_engine/constants.py`** - Constante `PROJECT_VERSION` no Python
5. **`src/hooks/useFileOperations.ts`** - Constante `PROJECT_VERSION` no TypeScript

## Como Atualizar a Versão

### Método Automático (Recomendado)

Use o script de atualização de versão:

**Linux/Mac:**
```bash
./scripts/update-version.sh 1.0.1
```

**Windows:**
```powershell
.\scripts\update-version.ps1 1.0.1
```

O script irá:
1. ✅ Validar o formato da versão (SemVer)
2. ✅ Atualizar todos os arquivos automaticamente
3. ✅ Mostrar os próximos passos (atualizar CHANGELOG, commit, tag)

### Método Manual

Se preferir atualizar manualmente:

1. Edite `VERSION` com a nova versão
2. Execute o script para propagar: `./scripts/update-version.sh`
3. Ou atualize cada arquivo manualmente:
   - `package.json`: campo `"version"`
   - `package-lock.json`: campos `"version"` e `"packages.""."version"`
   - `py_engine/constants.py`: `PROJECT_VERSION = 'X.Y.Z'`
   - `src/hooks/useFileOperations.ts`: `const PROJECT_VERSION = 'X.Y.Z'`

## Workflow de Release

### 1. Atualizar Versão

```bash
# Exemplo: nova versão 1.1.0
./scripts/update-version.sh 1.1.0
```

### 2. Atualizar CHANGELOG.md

Documente as mudanças na nova versão seguindo o formato [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [1.1.0] - 2026-02-18

### Added
- Nova funcionalidade X
- Nova funcionalidade Y

### Changed
- Melhoria na funcionalidade Z

### Fixed
- Correção do bug W
```

### 3. Commit e Tag

```bash
# Commit das mudanças
git add .
git commit -m "chore: bump version to 1.1.0"

# Criar tag anotada
git tag -a v1.1.0 -m "Release v1.1.0"

# Push com tags
git push && git push --tags
```

### 4. Verificar Deploy

O GitHub Actions irá automaticamente:
- Executar testes
- Fazer build
- Deploy para Cloud Run (se configurado)

## Verificação de Versionamento

Para verificar se todos os arquivos estão com a versão correta:

```bash
# Verificar VERSION
cat VERSION

# Verificar package.json
grep '"version"' package.json

# Verificar Python
grep 'PROJECT_VERSION' py_engine/constants.py

# Verificar TypeScript
grep 'PROJECT_VERSION' src/hooks/useFileOperations.ts
```

Todos devem mostrar a **mesma versão**.

## Integração CI/CD

### GitHub Actions Workflow

O projeto inclui um workflow automático (`.github/workflows/version-check.yml`) que valida a consistência de versionamento em cada Pull Request.

**O workflow verifica:**
- ✅ Existência do arquivo VERSION
- ✅ Formato válido de Semantic Versioning
- ✅ Consistência entre todos os arquivos com versão
- ✅ Execução dos testes de versionamento

**Quando é executado:**
- Em Pull Requests para branches principais (main, production, release/*)
- Quando arquivos de versão são modificados
- Manualmente via workflow_dispatch

### Usando Versão em Workflows

Os workflows do GitHub Actions podem acessar a versão através de:

```yaml
- name: Get version
  id: version
  run: echo "version=$(cat sisrua_unified/VERSION)" >> $GITHUB_OUTPUT

- name: Use version
  run: echo "Building version ${{ steps.version.outputs.version }}"
```

### Proteção de Branch

Recomenda-se configurar a proteção de branch para exigir que o workflow de verificação de versão passe antes de fazer merge:

1. Vá para Settings > Branches no GitHub
2. Adicione uma regra para branches protegidas (main, production)
3. Marque "Require status checks to pass before merging"
4. Selecione "Version Consistency Check"


## Histórico de Versões

Consulte [CHANGELOG.md](./CHANGELOG.md) para ver o histórico completo de mudanças.

## Exemplos de Versionamento

### Versões de Desenvolvimento
- `1.0.0-dev` - Desenvolvimento em andamento
- `1.0.0-alpha.1` - Primeira versão alpha
- `1.0.0-beta.1` - Primeira versão beta
- `1.0.0-rc.1` - Release candidate

### Versões de Produção
- `1.0.0` - Release inicial
- `1.0.1` - Patch (correção de bugs)
- `1.1.0` - Minor (nova funcionalidade)
- `2.0.0` - Major (breaking change)

### Versões com Metadata
- `1.0.0+20260218` - Com data de build
- `1.0.0+build.123` - Com número de build
- `1.0.0-beta.1+exp.sha.5114f85` - Combinação

## Troubleshooting

### Versões Inconsistentes

Se encontrar versões inconsistentes entre arquivos:

1. Verifique qual é a versão correta (geralmente a mais recente)
2. Atualize `VERSION` com a versão correta
3. Execute `./scripts/update-version.sh` (sem argumentos) e insira a versão quando solicitado
4. Commit das mudanças

### Script Não Executa

**Linux/Mac:**
```bash
chmod +x scripts/update-version.sh
./scripts/update-version.sh
```

**Windows (PowerShell):**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\update-version.ps1
```

## Referências

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Git Tagging](https://git-scm.com/book/en/v2/Git-Basics-Tagging)
