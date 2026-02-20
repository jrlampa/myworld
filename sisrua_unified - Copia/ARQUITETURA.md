# Arquitetura do Projeto SISRua Unified

## Visão Geral
O projeto é composto por três principais camadas:
- **Frontend**: React (TypeScript) localizado em `src/`
- **Backend**: Node.js/TypeScript localizado em `server/`
- **Engine Python**: Scripts e módulos Python em `py_engine/`

A comunicação entre backend e engine Python é feita via chamadas de sistema (provavelmente via subprocessos ou API REST local).

## Estrutura de Diretórios
- `src/` — Aplicação React (componentes, hooks, serviços)
- `server/` — Backend Node.js/TypeScript (rotas, middlewares, serviços)
- `py_engine/` — Engine Python (análises, cálculos, utilitários)
- `scripts/` — Scripts utilitários e de teste
- `test_files/` — Arquivos de teste (DXF, JSON)
- `Dockerfile` — Configuração de containerização

## Fluxo de Dados
1. Usuário interage com o frontend React.
2. Frontend faz requisições ao backend Node.js.
3. Backend processa, pode acionar engine Python para cálculos/análises.
4. Resultados retornam ao frontend.

## Pontos de Integração
- Backend aciona engine Python para tarefas específicas (ex: análise de arquivos DXF).
- Docker orquestra ambiente unificado para frontend, backend e engine Python.

## Observações
- Não há documentação detalhada de APIs ou fluxos internos.
- Recomenda-se detalhar endpoints, contratos de dados e exemplos de uso.

---

> **Atualize este documento conforme o projeto evoluir.**
