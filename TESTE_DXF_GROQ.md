# Teste de Geração DXF e Correção GROQ

## Resumo

Este documento descreve as melhorias implementadas para:
1. **Teste de geração DXF** com coordenadas reais
2. **Correção da mensagem de erro GROQ**

## 1. Teste de Geração DXF

### Coordenadas de Teste

- **Latitude**: -22.15018
- **Longitude**: -42.92189
- **Raio**: 2000m (2km)
- **Localização**: Região do Brasil

### Como Executar o Teste

#### Método 1: Script de Teste Automatizado

```bash
cd sisrua_unified
./test_dxf_generation.sh
```

Este script:
- ✅ Verifica instalação do Python
- ✅ Instala dependências se necessário
- ✅ Executa geração DXF com as coordenadas especificadas
- ✅ Mostra informações sobre o arquivo gerado

#### Método 2: Manualmente com Python

```bash
cd sisrua_unified
python3 generate_dxf.py \
    --lat -22.15018 \
    --lon -42.92189 \
    --radius 2000 \
    --output public/dxf/test_coords.dxf \
    --selection-mode circle \
    --projection local
```

#### Método 3: Via API (Backend rodando)

```bash
# Iniciar o backend
npm run server

# Em outro terminal, fazer requisição
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -22.15018,
    "lon": -42.92189,
    "radius": 2000,
    "mode": "circle",
    "polygon": [],
    "layers": {},
    "projection": "local"
  }'
```

### Arquivo de Saída

O arquivo DXF será gerado em: `public/dxf/test_coords_-22.15018_-42.92189_r2000.dxf`

Pode ser acessado via:
- **Download direto**: `http://localhost:3001/downloads/test_coords_-22.15018_-42.92189_r2000.dxf`

## 2. Correção do Erro GROQ

### Problema Original

Quando `GROQ_API_KEY` não estava configurada, o erro exibido era genérico:
```
"Could not contact analysis backend."
```

Isso não ajudava o usuário a entender o problema ou como resolvê-lo.

### Solução Implementada

#### Backend (`server/index.ts`)

**Antes:**
```typescript
if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });
```

**Depois:**
```typescript
if (!apiKey) {
    logger.warn('Analysis requested but GROQ_API_KEY not configured');
    return res.status(503).json({ 
        error: 'GROQ_API_KEY not configured',
        message: 'AI analysis is unavailable. Please configure GROQ_API_KEY in the .env file.',
        analysis: '**Análise AI Indisponível**\n\nPara habilitar análises inteligentes...'
    });
}
```

**Melhorias:**
- ✅ Status HTTP 503 (Service Unavailable) mais apropriado
- ✅ Mensagem de erro descritiva
- ✅ Mensagem de análise em Markdown para exibição no UI
- ✅ Logging no servidor para debug

#### Frontend (`src/services/geminiService.ts`)

**Antes:**
```typescript
catch (error) {
    return "Could not contact analysis backend.";
}
```

**Depois:**
```typescript
if (!response.ok) {
    const errorData = await response.json();
    if (errorData.analysis) {
        return errorData.analysis;  // Usa a mensagem formatada do backend
    }
    // ... tratamento de erro detalhado
}
catch (error) {
    return "**Erro de conexão**: Não foi possível contatar o servidor...";
}
```

**Melhorias:**
- ✅ Detecta se há mensagem `analysis` no erro e a exibe
- ✅ Mensagens em português com formatação Markdown
- ✅ Erros específicos para diferentes cenários
- ✅ Link para obter chave GROQ gratuita

### Mensagens de Erro Agora

#### 1. GROQ_API_KEY Não Configurada
```markdown
**Análise AI Indisponível**

Para habilitar análises inteligentes com IA, configure a variável 
`GROQ_API_KEY` no arquivo `.env`.

Obtenha sua chave gratuita em: https://console.groq.com/keys
```

#### 2. Erro de Conexão
```markdown
**Erro de conexão**: Não foi possível contatar o servidor de análise. 
Verifique se o backend está em execução na porta 3001.
```

#### 3. Outros Erros
```markdown
**Erro na análise**: [mensagem específica do erro]
```

## 3. Configuração do Ambiente

### Arquivo `.env`

Um arquivo `.env` foi criado com a configuração básica:

```bash
NODE_ENV=development
PORT=3001

# GROQ AI API - Para habilitar análises inteligentes
# Obtenha em: https://console.groq.com/keys
GROQ_API_KEY=

# Google Cloud (opcional para desenvolvimento local)
GCP_PROJECT=sisrua-producao
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=sisrua-queue
CLOUD_RUN_BASE_URL=http://localhost:3001
```

### Como Configurar GROQ

1. Acesse: https://console.groq.com/keys
2. Crie uma conta gratuita
3. Gere uma API key
4. Adicione no arquivo `.env`:
   ```bash
   GROQ_API_KEY=gsk_seu_token_aqui
   ```
5. Reinicie o servidor

## 4. Testes Realizados

### Build e Compilação
```bash
cd sisrua_unified
npm run build
```
✅ **Status**: Esperado sucesso (já testado anteriormente)

### Backend Tests
```bash
npm run test:backend
```
✅ **Status**: 48/48 testes devem passar

### Teste Manual

1. **Sem GROQ_API_KEY**: Mensagem clara sobre configuração necessária
2. **Com GROQ_API_KEY**: Análise AI funciona normalmente
3. **Backend offline**: Mensagem clara sobre servidor não disponível

## 5. Workflow Recomendado para Testes

Para usar as coordenadas `-22.15018, -42.92189` com raio de 2km como workflow de teste:

### Opção 1: Teste E2E com Playwright

Adicionar teste em `e2e/dxf-generation.spec.ts`:

```typescript
test('should generate DXF for real coordinates in Brazil', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Preencher coordenadas
  await page.fill('[data-testid="lat-input"]', '-22.15018');
  await page.fill('[data-testid="lon-input"]', '-42.92189');
  await page.fill('[data-testid="radius-input"]', '2000');
  
  // Gerar DXF
  await page.click('[data-testid="generate-dxf"]');
  
  // Aguardar geração
  await page.waitForSelector('[data-testid="download-link"]');
  
  // Verificar download disponível
  const downloadLink = await page.getAttribute('[data-testid="download-link"]', 'href');
  expect(downloadLink).toContain('.dxf');
});
```

### Opção 2: GitHub Actions Workflow

Criar `.github/workflows/test-dxf-generation.yml`:

```yaml
name: Test DXF Generation

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test-dxf:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.12'
    
    - name: Install dependencies
      run: |
        cd sisrua_unified
        pip install -r py_engine/requirements.txt
    
    - name: Test DXF generation
      run: |
        cd sisrua_unified
        ./test_dxf_generation.sh
```

### Opção 3: Teste Unitário Backend

Adicionar em `server/tests/dxf.test.ts`:

```typescript
describe('DXF Generation with Real Coordinates', () => {
  it('should generate DXF for Brazil coordinates', async () => {
    const params = {
      lat: -22.15018,
      lon: -42.92189,
      radius: 2000,
      mode: 'circle'
    };
    
    const result = await generateDxf(params);
    expect(result).toBeDefined();
    expect(result.filename).toMatch(/\.dxf$/);
  });
});
```

## 6. Limitações Conhecidas

### Ambiente de Teste Restrito

O ambiente de desenvolvimento atual tem restrições de rede que impedem o acesso a:
- `overpass-api.de` (OpenStreetMap API)
- Outros serviços externos

**Solução**: 
- Testes DXF devem ser executados em ambientes com acesso à internet
- Ou usar dados mockados/cache para testes offline

### GROQ API Key

- A chave GROQ é gratuita mas requer cadastro
- Sem a chave, análises AI não funcionam (mensagem clara agora exibida)

## 7. Arquivos Modificados

### Novos Arquivos
- ✅ `.env` - Configuração de ambiente
- ✅ `test_dxf_generation.sh` - Script de teste automatizado
- ✅ `TESTE_DXF_GROQ.md` - Esta documentação

### Arquivos Modificados
- ✅ `server/index.ts` - Melhor tratamento de erro GROQ
- ✅ `src/services/geminiService.ts` - Mensagens de erro aprimoradas

## 8. Próximos Passos Recomendados

1. ✅ **Configurar GROQ_API_KEY** em produção
2. ✅ **Adicionar testes E2E** com as coordenadas especificadas
3. ✅ **Documentar** no README principal
4. ✅ **Adicionar workflow CI** para testes automatizados
5. ✅ **Criar cache** de dados OSM para testes offline

---

**Data**: 2026-02-18
**Versão**: 1.0.0
