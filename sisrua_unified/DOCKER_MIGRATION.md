# 🐳 Migração para Arquitetura Docker-First

## 📋 Resumo das Mudanças

O projeto **SIS RUA Unified** foi atualizado para usar **Docker como método PRIMARY** de distribuição, implementando uma arquitetura enterprise-level que isola completamente o motor Python e elimina dependências de binários .exe.

---

## 🎯 O Que Mudou?

### Antes (Arquitetura Antiga)

```
Desenvolvimento:
1. Instalar Node.js manualmente
2. Instalar Python manualmente
3. npm install
4. pip install -r requirements.txt
5. npm run dev

Build para Produção:
1. npm run build:all
2. PyInstaller compila Python → .exe
3. Antivírus pode bloquear .exe
4. Deploy manual de binários
```

### Agora (Arquitetura Docker-First)

```
Desenvolvimento:
1. docker compose up
   ↓
   Pronto! Tudo funciona automaticamente

Build para Produção:
1. npm run docker:build
2. Deploy automatizado para Cloud Run
3. Python roda nativamente em container
4. Zero problemas com antivírus
```

---

## 🔄 Mudanças Técnicas

### 1. pythonBridge.ts - Simplificado

**Antes** (~30 linhas de lógica condicional):
```typescript
// Lógica complexa para escolher entre .exe ou Python
if (isProduction || fs.existsSync(devExePath)) {
    const finalExePath = isProduction ? prodExePath : devExePath;
    if (fs.existsSync(finalExePath)) {
        command = finalExePath;  // Usa .exe
        args = [];
    } else {
        command = 'python';
        args = [scriptPath];
    }
} else {
    command = 'python';
    args = [scriptPath];
}
```

**Agora** (~8 linhas, sempre Python):
```typescript
// DOCKER-FIRST: Sempre usa Python diretamente
const scriptPath = path.join(process.cwd(), 'py_engine/main.py');
const pythonCommand = process.env.PYTHON_COMMAND || 'python3';

const command = pythonCommand;
const args = [scriptPath];
```

**Benefícios**:
- ✅ Código 73% mais simples
- ✅ Zero ambiguidade
- ✅ Funciona em qualquer ambiente (Docker, nativo, CI/CD)
- ✅ Customizável via variável de ambiente

### 2. Novos Scripts NPM

Adicionados scripts específicos para Docker:

```json
{
  "docker:build": "docker build -t sisrua-unified:latest .",
  "docker:run": "docker run -p 8080:8080 --env-file .env sisrua-unified:latest",
  "docker:dev": "docker compose up",
  "docker:dev:build": "docker compose up --build",
  "docker:down": "docker compose down",
  "docker:logs": "docker compose logs -f app"
}
```

### 3. Variáveis de Ambiente

Novas variáveis para controle do Python:

| Variável | Valor Padrão | Propósito |
|----------|--------------|-----------|
| `PYTHON_COMMAND` | `python3` | Comando Python a usar |
| `DOCKER_ENV` | `true` (em containers) | Flag indicando ambiente Docker |

### 4. Deprecação de build_release.ps1

O script PowerShell de build `.exe` foi **DEPRECATED**:
- ⚠️ Aviso de depreciação adicionado
- 🐳 Recomenda usar `npm run docker:build`
- 📝 Permanece apenas para compatibilidade com dev Windows legado

---

## 🚀 Como Migrar?

### Para Desenvolvedores

**Opção 1: Docker (Recomendado - Zero Configuração)**

```bash
# 1. Certifique-se de ter Docker instalado
docker --version

# 2. Clone/atualize o repositório
git pull origin main

# 3. Inicie o ambiente
cd sisrua_unified
docker compose up

# 4. Acesse
# http://localhost:8080
```

**Opção 2: Nativo (Requer Node.js + Python instalados)**

```bash
# 1. Instale dependências
npm install
pip install -r py_engine/requirements.txt

# 2. Defina variável de ambiente (opcional)
export PYTHON_COMMAND=python3

# 3. Inicie desenvolvimento
npm run dev
```

### Para Administradores de Sistema

**Produção (Cloud Run)**:
- ✅ **Nenhuma ação necessária** - Deploy já usa Docker
- ✅ GitHub Actions continua funcionando normalmente
- ✅ Variáveis `PYTHON_COMMAND` e `DOCKER_ENV` já configuradas no Dockerfile

**Produção (Self-hosted)**:
```bash
# 1. Build da imagem
npm run docker:build

# 2. Run
npm run docker:run

# Ou use Kubernetes/Docker Swarm com a imagem gerada
```

---

## 🔍 Perguntas Frequentes

### 1. Os binários .exe ainda são gerados?

**Não por padrão.** O script `build_release.ps1` foi deprecado e só deve ser usado em casos específicos de desenvolvimento Windows legado.

### 2. O que acontece se eu rodar `npm run build:all`?

Você verá um aviso de depreciação recomendando usar Docker. O script ainda funciona, mas não é mais o método recomendado.

### 3. Como atualizar um ambiente existente?

```bash
# Pare containers antigos
docker compose down

# Atualize código
git pull

# Rebuild e reinicie
docker compose up --build
```

### 4. E se eu não puder usar Docker?

Você ainda pode usar instalação nativa (Node.js + Python), mas:
- Precisa instalar dependências manualmente
- Pode ter problemas com antivírus (falsos positivos)
- Setup mais demorado (~30 min vs 2 min com Docker)

### 5. Meu CI/CD precisa mudar?

**Não.** Se você usa Cloud Run, nada muda. O deploy já usa Docker.

Se você tem CI/CD customizado, apenas certifique-se de usar:
```bash
npm run docker:build  # Em vez de npm run build:all
```

### 6. Variável PYTHON_COMMAND é obrigatória?

**Não.** O padrão é `python3`, que funciona na maioria dos ambientes. Só customize se:
- Usar Python com nome diferente (`python`, `python3.11`, etc.)
- Precisar de versão específica do Python

### 7. Como testar se está funcionando?

```bash
# Inicie Docker
docker compose up

# Em outro terminal, teste
curl http://localhost:8080/health

# Você deve ver: {"status":"ok"}
```

---

## 📊 Comparação de Métodos

| Aspecto | .exe (Antigo) | Docker (Novo) |
|---------|---------------|---------------|
| **Setup Time** | ~30 min (manual) | ~2 min (automático) |
| **Isolamento** | ❌ Roda no SO host | ✅ Container isolado |
| **Antivírus** | ⚠️ Falsos positivos | ✅ Sem problemas |
| **Portabilidade** | ❌ Windows-only | ✅ Multi-plataforma |
| **Escalabilidade** | ❌ Manual | ✅ Auto-scaling |
| **Manutenção** | ❌ Rebuild a cada mudança | ✅ CI/CD automatizado |
| **Dependências** | ❌ Instalação manual | ✅ Self-contained |
| **Production-ready** | ⚠️ Requer setup | ✅ Deploy direto |

---

## ✅ Checklist de Migração

### Para Time de Desenvolvimento

- [ ] Instalar Docker Desktop
- [ ] Clonar/atualizar repositório
- [ ] Testar `docker compose up`
- [ ] Verificar acesso a http://localhost:8080
- [ ] Atualizar README da equipe com novo processo

### Para DevOps/Infraestrutura

- [ ] Revisar configurações de deploy (se self-hosted)
- [ ] Atualizar scripts de CI/CD (se necessário)
- [ ] Validar variáveis de ambiente em produção
- [ ] Testar build Docker: `npm run docker:build`
- [ ] Atualizar documentação de deploy

### Para Gestores de Projeto

- [ ] Comunicar mudança para a equipe
- [ ] Agendar treinamento Docker (se necessário)
- [ ] Atualizar timeline de onboarding de novos devs (reduzido para 2 min)
- [ ] Celebrar simplificação! 🎉

---

## 🆘 Suporte

Se encontrar problemas durante a migração:

1. **Verifique Docker**: `docker --version` e `docker compose version`
2. **Logs**: `docker compose logs -f app`
3. **Rebuild**: `docker compose down && docker compose up --build`
4. **Guia Completo**: [DOCKER_USAGE.md](./DOCKER_USAGE.md)
5. **Issues**: [GitHub Issues](https://github.com/jrlampa/myworld/issues)

---

## 📚 Documentação Relacionada

- **[DOCKER_USAGE.md](./DOCKER_USAGE.md)** - Guia completo de uso do Docker
- **[DOCKER_EVALUATION.md](../DOCKER_EVALUATION.md)** - Análise técnica detalhada
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Arquitetura do sistema
- **[README.md](./README.md)** - Documentação principal

---

**Data de Implementação**: 2026-02-18  
**Versão**: 1.0  
**Status**: ✅ Produção
