# Documentação do Projeto SISRua Unified

## Descrição
Sistema unificado para análise, processamento e visualização de dados topográficos e urbanos, integrando frontend (React), backend (Node.js/TypeScript) e engine Python.

## Estrutura
- Veja `ARQUITETURA.md` para detalhes técnicos e fluxos.
- Frontend: `src/`
- Backend: `server/`
- Engine Python: `py_engine/`

## Instalação e Uso
1. Instale dependências Node.js:
   ```sh
   npm install
   ```
2. Instale dependências Python:
   ```sh
   pip install -r requirements.txt
   ```
3. Para desenvolvimento, utilize Docker ou ambientes virtuais separados.

## Scripts Úteis
- `npm run lint` — Verifica padrões de código JS/TS
- `npm run format` — Formata código JS/TS
- `black .` — Formata código Python

## Testes
- Scripts de teste em `scripts/` e `py_engine/tests/`
- (Adicionar instruções de execução de testes automatizados quando disponíveis)

## Contribuição
- Siga padrões de código definidos por ESLint, Prettier e Black.
- Documente novas funcionalidades e fluxos.

## Contato
- (Adicionar informações de contato/responsáveis)

---
> **Mantenha este README atualizado.**
