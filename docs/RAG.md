# RAG – Memória de Trabalho do Projeto sisRUA Unified

> **Finalidade**: Documento de memória de trabalho evolutivo para o agente de desenvolvimento.
> Serve como RAG (Retrieval-Augmented Generation) interno para contextualizar decisões de arquitetura,
> regras de negócio, coordenadas de teste e padrões de código.

---

## 1. Identidade do Projeto

| Campo | Valor |
|---|---|
| **Nome** | sisRUA Unified |
| **Versão** | 1.2.0 (backend/server) / 1.0.0 (package.json) |
| **Objetivo** | Exportar dados OSM para DXF 2.5D georreferenciado |
| **Stack** | Node.js 22 + TypeScript (backend/frontend) + Python 3.12 (motor DXF) |
| **Deploy** | Docker → Google Cloud Run (southamerica-east1) |
| **Branch de trabalho** | `dev` (nunca direto na `main`) |

---

## 2. Regras NÃO Negociáveis

1. **Trabalhar apenas na branch `dev`**.
2. **Zero dados mockados** – APIs reais: Overpass, Open-Meteo, Nominatim, GROQ.
3. **Zero custo** – somente APIs públicas/gratuitas.
4. **2.5D exclusivamente** (não usar 3D real) – edificações com `thickness`, terreno com `polyline3d`.
5. **Modularidade** – arquivos com >500 linhas devem ser divididos.
6. **Responsabilidade Única (SRP)** – cada módulo tem uma única função clara.
7. **UI/UX em pt-BR** – toda interface de usuário deve estar em português do Brasil.
8. **Docker first** – desenvolvimento e deploy via Docker.
9. **DDD** – Arquitetura orientada a Domain-Driven Design.
10. **Segurança** – sanitização de dados, sem exposição de secrets, rate limiting.

---

## 3. Coordenadas de Teste Canônicas

```
UTM 23K: E=788547, N=7634925 → raio 100m
WGS84  : lat=-22.15018, lon=-42.92185 → raios 500m e 1km
Cidade : Muriaé, MG, Brasil
```

Exportadas em:
- `src/constants.ts` → `TEST_COORDS`
- `py_engine/constants.py` → `TEST_LAT, TEST_LON, TEST_UTM_E, TEST_UTM_N, TEST_RADII`

**USO**: Todos os testes de integração e E2E devem usar essas coordenadas.

---

## 4. Arquitetura de Módulos

```
sisrua_unified/
├── server/                    # Backend TypeScript (Express)
│   ├── index.ts               # Bootstrap – <220 linhas
│   ├── routes/                # Rotas modularizadas por domínio
│   │   ├── health.ts          # /health, /api/firestore/status
│   │   ├── jobs.ts            # /api/jobs/:id, /downloads/:filename
│   │   ├── dxf.ts             # /api/dxf, /api/batch/dxf
│   │   ├── analysis.ts        # /api/search, /api/elevation/profile, /api/analyze
│   │   └── tasks.ts           # /api/tasks/process-dxf (Cloud Tasks webhook)
│   ├── services/              # Serviços de domínio
│   ├── schemas/               # Validação Zod
│   ├── middleware/            # Auth, rate limiting
│   └── utils/                 # Logger
│
├── py_engine/                 # Motor Python (geração DXF)
│   ├── dxf_generator.py       # Classe principal + orquestração
│   ├── dxf_drawing.py         # Mixin: desenho de geometrias (polígono, linha, ponto)
│   ├── dxf_cartography.py     # Mixin: legenda, carimbo, grade de coordenadas
│   ├── dxf_styles.py          # Estilos CAD (StyleManager)
│   ├── osmnx_client.py        # Cliente OSM/Overpass
│   ├── elevation_client.py    # Cliente Open-Meteo
│   ├── contour_generator.py   # Gerador de curvas de nível
│   └── spatial_audit.py       # Auditoria espacial BIM
│
└── src/                       # Frontend React + TypeScript
    ├── App.tsx                 # Orquestrador – <290 linhas
    ├── components/
    │   ├── AppHeader.tsx       # Cabeçalho da aplicação
    │   ├── AppSidebar.tsx      # Painel lateral completo
    │   └── ...                 # Outros componentes
    ├── hooks/                  # Custom hooks
    ├── services/               # Serviços de API frontend
    └── constants.ts            # Constantes globais + TEST_COORDS
```

---

## 5. Regras de Camadas DXF

| Camada | Conteúdo | Cor ACI |
|---|---|---|
| `EDIFICACAO` | Polígonos de edificações (com `thickness` 2.5D) | 5 |
| `VIAS` | Eixos de ruas/vias | 1 |
| `VIAS_MEIO_FIO` | Offsets paralelos (meios-fios) | 251 |
| `VEGETACAO` | Árvores, bosques, parques | 3 |
| `MOBILIARIO_URBANO` | Postes, bancos, lixeiras | 2 |
| `INFRA_POWER_HV` | Linhas de alta tensão | 1 |
| `INFRA_POWER_LV` | Rede elétrica baixa tensão | 30 |
| `INFRA_TELECOM` | Telecomunicações | 90 |
| `TOPOGRAFIA_CURVAS` | Curvas de nível | 8 |
| `TERRENO` | Malha de terreno 2.5D | 252 |
| `TEXTO` | Rótulos de vias | 7 |
| `QUADRO` | Quadro, norte, escala | 7 |
| `EDIFICACAO_HATCH` | Hachura ANSI31 de edificações | 253 |
| `ANNOT_AREA` | Anotação de área (m²) | 7 |
| `ANNOT_LENGTH` | Anotação de comprimento (m) | 7 |

---

## 6. APIs Externas Utilizadas (Zero Custo)

| API | Uso | URL |
|---|---|---|
| **Overpass API** | Dados OSM (vias, edificações, etc.) | `overpass-api.de`, `overpass.kumi.systems` |
| **Nominatim** | Geocodificação de endereços | `nominatim.openstreetmap.org` |
| **Open-Meteo** | Dados de elevação (DTM) | `api.open-meteo.com` |
| **GROQ** | Análise AI (requer API key gratuita) | `api.groq.com` |
| **osmnx** | Cliente Python para OSM | biblioteca Python |

---

## 7. Padrões de Testes

### Python
- **Framework**: `pytest`
- **Diretório**: `py_engine/tests/`
- **Padrão de execução headless**: `python3 -m pytest py_engine/tests/ -v`
- **DXF headless**: validação via `ezdxf.readfile()` (sem accoreconsole.exe em Linux)

### TypeScript/Node.js
- **Backend**: Jest (`server/tests/`)
- **Frontend**: Vitest (`tests/`)
- **E2E**: Playwright (`e2e/`)

### Coordenadas de Teste Obrigatórias
Todos os testes de integração DXF **devem** usar `TEST_LAT=-22.15018, TEST_LON=-42.92185`.

---

## 8. Roles de Desenvolvimento

| Role | Responsabilidade |
|---|---|
| **Tech Lead** | Arquitetura, revisão de PRs, decisões de design |
| **Dev Fullstack Sênior** | Implementação principal, modularização, backend+frontend |
| **DevOps/QA** | Docker, CI/CD, testes, segurança |
| **UI/UX Designer** | Interface pt-BR, acessibilidade, responsividade |
| **Estagiário** | Criatividade, novas ideias, protótipos |

---

## 9. Histórico de Decisões Técnicas

### 2026-02 – Modularização do servidor
- `server/index.ts` dividido em `server/routes/` (health, jobs, dxf, analysis, tasks)
- Redução de 985 → 217 linhas no arquivo principal

### 2026-02 – Modularização do gerador DXF
- `dxf_generator.py` (709 linhas) → 3 módulos via Mixins:
  - `dxf_drawing.py` (241 linhas)
  - `dxf_cartography.py` (169 linhas)
  - `dxf_generator.py` refatorado (286 linhas)

### 2026-02 – Modularização do App.tsx
- `App.tsx` (576 linhas) → 3 arquivos:
  - `AppHeader.tsx` (65 linhas)
  - `AppSidebar.tsx` (268 linhas)
  - `App.tsx` refatorado (285 linhas)

### 2026-02 – Internacionalização pt-BR
- Interface migrada para português do Brasil
- Labels, mensagens de erro, tooltips em pt-BR

### 2026-02 – Otimização de queries OSM para áreas grandes
- `osmnx_client.py` refatorado com estratégia de chunked fetching para raios >1km
- Novas funções: `_fetch_chunked()`, `_intersect_tags()`, `_project_gdf()`
- Deduplicação automática de features por índice no merge
- Fallback por grupo: erro em um chunk não cancela os demais
- 20 novos testes unitários (mocked) em `py_engine/tests/test_osmnx_client.py`

### 2026-02 – Analytics Dashboard SaaS implementado
- `server/services/analyticsService.ts` — serviço in-memory com prune 7 dias, cluster regiões, top5
- `server/routes/analytics.ts` — `GET /api/analytics` e `GET /api/analytics/events`
- `src/components/AnalyticsDashboard.tsx` — dashboard pt-BR dark/light com KPI cards, gráficos Recharts
- `src/services/analyticsService.ts` — cliente fetch frontend
- Instrumentação em `routes/dxf.ts` (record por exportação)
- `AppSidebar.tsx` com abas ANÁLISE / MÉTRICAS
- 14 novos testes unitários; 117 testes backend total

### 2026-02 – Expansão de testes e métricas de analytics
- `exportsByMode` adicionado ao `AnalyticsSummary` (diferencia circle vs polygon)
- 3 novos arquivos de teste: `analyticsRoutes.test.ts` (integração HTTP endpoints), `dnitService.test.ts` (16 testes, 100% cobertura), `incraService.test.ts` (14 testes, 100% cobertura)
- Backend: 117 → 149 testes; cobertura 94.79% → 95.37% statements

---

## 10. Checklist de Conformidade

- [x] Branch de trabalho: `dev`/PR a partir de branch de feature
- [x] Zero dados mockados (APIs reais)
- [x] 2.5D exclusivo (thickness, polyline3d)
- [x] Modularidade (nenhum arquivo > 500 linhas)
- [x] SRP (separação de responsabilidades)
- [x] UI/UX em pt-BR
- [x] Docker first (Dockerfile + docker-compose.yml)
- [x] DDD (routes, services, schemas, middleware)
- [x] Segurança (rate limiting, sanitização, CORS)
- [x] Testes unitários (Jest + Vitest + pytest)
- [x] Testes DXF headless (ezdxf.readfile)
- [x] Coordenadas de teste canônicas definidas
- [x] .gitignore e .dockerignore atualizados
- [x] Analytics Dashboard SaaS (métricas de uso, gráficos, KPIs, pt-BR)
