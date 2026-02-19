# Diagnóstico: Problema de Geração DXF

## Resumo da Investigação

Investigamos as diferenças entre o commit `f34b5eabb97caf925689c3ffddf4b0dce45f15fb` (funcionando) e a versão atual (HEAD) para identificar problemas na geração de arquivos DXF.

## Conclusão Principal

**O código atual está MELHOR que o commit f34b5ea, não pior.**

Todas as mudanças feitas após f34b5ea foram MELHORIAS e CORREÇÕES:
- Adição do parâmetro `projection` (nova funcionalidade)
- Adição do parâmetro `layers` no modo desenvolvimento  
- Correção de erros de resposta dupla (return statements)
- Melhor tratamento de erros
- Melhor validação de entrada
- Health check aprimorado

## Diferenças Principais Entre f34b5ea e HEAD

### 1. pythonBridge.ts
**Mudanças:**
- `python` → `python3` (ambos funcionam na maioria dos sistemas)
- Removido suporte a .exe → Abordagem Docker-first
- Adicionado suporte ao parâmetro `projection`
- Melhor logging e detecção de ambiente

**Status:** ✅ MELHORIA

### 2. cloudTasksService.ts  
**Mudanças:**
- Adicionado `layers` no modo dev (estava faltando antes)
- Adicionado `projection` no modo dev (estava faltando antes)
- Melhor tratamento de erros IAM

**Status:** ✅ CORREÇÃO

### 3. server/index.ts
**Mudanças:**
- Adicionados `return` statements (previne erros de resposta dupla)
- Adicionado error handler global
- Melhor validação e CORS
- Health check aprimorado com verificação Python

**Status:** ✅ MELHORIA

## Causas Potenciais de Problemas

Se a geração DXF não está funcionando, as causas mais prováveis são:

### 1. Dependências Python Não Instaladas ⚠️

**Sintoma:** Erro ao tentar gerar DXF
**Solução:**
```bash
cd sisrua_unified
pip3 install -r py_engine/requirements.txt
```

**Verificação:**
```bash
python3 -c "import osmnx, ezdxf, geopandas; print('OK')"
```

### 2. Problemas de Conectividade com API OSM ⚠️

**Sintoma:** Timeout ou erro ao buscar dados OSM
**Causa:** API Overpass pode estar lenta ou inacessível
**Solução:**
- Tentar novamente mais tarde
- Usar raio menor (< 500m)
- Verificar conectividade: `curl https://overpass-api.de/api/status`

**Configuração de Timeout:**
O osmnx usa timeout de 180 segundos por padrão. Para áreas grandes ou conexões lentas, isso pode não ser suficiente.

### 3. Variável de Ambiente PYTHON_COMMAND ⚠️

**Sintoma:** "python3 not found" ou similar
**Solução:**
```bash
export PYTHON_COMMAND=python3
# ou
export PYTHON_COMMAND=python
```

### 4. Problemas de Permissão (Docker/Cloud) ⚠️

**Sintoma:** Erro ao criar arquivos ou acessar diretórios
**Solução:** Verificar permissões do diretório `public/dxf`

## Como Testar

### Script de Diagnóstico Automático
```bash
cd sisrua_unified

# Linux/Mac:
chmod +x diagnose_dxf.sh
./diagnose_dxf.sh

# Windows (Git Bash ou WSL):
bash diagnose_dxf.sh
```

Este script verificará automaticamente todos os requisitos e identificará problemas.

### Teste Rápido Manual
```bash
cd sisrua_unified

# 1. Instalar dependências Python
pip3 install -r py_engine/requirements.txt

# 2. Testar geração DXF com coordenadas pequenas
# Linux/Mac:
python3 py_engine/main.py \
  --lat -22.15018 \
  --lon -42.92189 \
  --radius 50 \
  --output ./test.dxf \
  --no-preview

# Windows:
python py_engine\main.py --lat -22.15018 --lon -42.92189 --radius 50 --output test.dxf --no-preview
```

### Teste Completo (via API)
```bash
# 1. Instalar dependências Node.js
npm install

# 2. Iniciar servidor
npm run server

# 3. Em outro terminal, testar API
curl -X POST http://localhost:3001/api/dxf \
  -H "Content-Type: application/json" \
  -d '{
    "lat": -22.15018,
    "lon": -42.92189,
    "radius": 100,
    "mode": "circle",
    "projection": "local"
  }'
```

## Comparação de Versões

| Aspecto | f34b5ea (Antigo) | HEAD (Atual) | Status |
|---------|------------------|--------------|---------|
| Comando Python | `python` | `python3` | ✅ Compatível |
| Suporte .exe | Sim | Não (Docker) | ⚠️ Mudança arquitetural |
| Parâmetro projection | ❌ Não | ✅ Sim | ✅ Novo recurso |
| Parâmetro layers (dev) | ❌ Não | ✅ Sim | ✅ Correção |
| Error handling | Básico | Avançado | ✅ Melhoria |
| Validação entrada | Básica | Completa (Zod) | ✅ Melhoria |
| Health check | Simples | Com verificação Python | ✅ Melhoria |

## Commits de Correção Após f34b5ea

- `f90bb7b`: Fix DXF generation, elevation, and GROQ API errors
- `cdb67ec`: fix: pass layers parameter in development mode
- `d94dd72`: fix: pass projection parameter to Python DXF generator  
- `8a521b8`: docs: add comprehensive summary of DXF error fixes
- `59ded44`: Fix GROQ error messages and add DXF test script

## Recomendações

1. **Não reverter para f34b5ea** - A versão atual tem correções importantes
2. **Verificar ambiente** - Garantir que Python e dependências estão instalados
3. **Testar conectividade** - Verificar acesso à API OSM
4. **Usar Docker** - Para ambiente consistente:
   ```bash
   docker-compose up
   ```

## Próximos Passos

Se o problema persistir após seguir este guia:

1. Coletar logs completos do erro
2. Verificar versão do Python: `python3 --version`
3. Verificar versões das dependências: `pip3 list | grep -E "osmnx|ezdxf|geopandas"`
4. Testar com raio muito pequeno (50m) para descartar timeout
5. Verificar firewall/proxy que possa bloquear acesso à API OSM

## Suporte

Para mais informações:
- Documentação DXF: `sisrua_unified/TESTE_DXF_GROQ.md`
- Documentação Docker: `sisrua_unified/DOCKER_USAGE.md`
- Guia de Deploy: `GUIA_DEPLOY.md`

