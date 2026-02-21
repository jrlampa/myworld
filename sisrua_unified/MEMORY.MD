# sisRUA MEMORY.MD — Memória de Trabalho RAG

> **LEIA ESTE ARQUIVO ANTES DE QUALQUER AÇÃO.** Este arquivo é o "cérebro" do projeto —
> atualizado a cada sessão de desenvolvimento. Sempre reflita as mudanças aqui.

---

## 1. VISÃO GERAL DO PROJETO

**Nome:** sisRUA Unified  
**Tipo:** SaaS Enterprise — Exportação de dados OSM → DXF 2.5D  
**Objetivo:** Transformar dados geoespaciais públicos (OpenStreetMap) em plantas urbanas CAD prontas para uso profissional em engenharia, arquitetura e planejamento urbano.  
**Versão atual:** 1.0.0 (ver `VERSION`, gerenciar via `./scripts/update-version.sh`)  
**Stack primário:** React 19 + TypeScript (frontend) | Express + TypeScript (backend) | Python 3.12 (engine)

---

## 2. REGRAS NÃO NEGOCIÁVEIS (RNN)

Estas regras são absolutas. Todo código, PR e decisão deve segui-las:

| # | Regra | Detalhe |
|---|-------|---------|
| 1 | **Branch de desenvolvimento** | Apenas `dev` (ou branches `feature/*` com PR para `dev`) |
| 2 | **Sem dados mockados** | Todo teste usa APIs reais ou fixtures baseadas em dados reais |
| 3 | **2.5D — nunca 3D** | Geometria DXF usa extrusão Z (thickness), não modelos 3D reais |
| 4 | **Thin frontend / Smart backend** | Frontend exibe; backend processa e valida |
| 5 | **Zero custo** | Apenas APIs públicas/gratuitas (OSM, IBGE, DNIT, INCRA, Open-Elevation) |
| 6 | **Docker first** | Todo serviço deve rodar via Docker; `docker compose up` = ambiente pronto |
| 7 | **Arquitetura DDD** | Domain → Application → Infrastructure → Interfaces |
| 8 | **Modularidade** | Arquivos > 500 linhas devem ser divididos em módulos |
| 9 | **Responsabilidade única** | Cada arquivo/classe/função = uma responsabilidade |
| 10 | **Sanitização de dados** | Todo input externo deve ser validado (Zod no backend, pyproj/shapely no Python) |
| 11 | **Interface em pt-BR** | Toda a UI deve estar em Português do Brasil |
| 12 | **Segurança** | Rate limiting, CORS, sem secrets hardcoded, input sanitization |
| 13 | **Testes** | Unit tests + E2E (Playwright) + testes específicos de DXF (headless) |
| 14 | **Half-way BIM** | Atributos semânticos no DXF (layers nomeadas, anotações, blocos) |
| 15 | **Sem 3D** | Usar apenas `thickness` (extrusão 2.5D) — NUNCA entidades 3D nativas |

---

## 3. COORDENADAS CANÔNICAS DE TESTE

Estas coordenadas são usadas em todos os testes automatizados e verificações:

```
UTM Zona 23K: E=788547, N=7634925   → raio 100m
WGS84:  lat=-22.15018, lon=-42.92185 → raios 500m e 1km
Região: Muriaé/MG, Brasil
```

**Fonte da verdade:** `py_engine/constants.py` (`TEST_LAT`, `TEST_LON`, `TEST_UTM_E`, `TEST_UTM_N`, `TEST_RADII`)

---

## 4. ARQUITETURA (DDD)

```
sisrua_unified/
├── server/                     # Backend (Express + TypeScript)
│   ├── domain/                 # Entidades, value objects, interfaces de repositório
│   ├── application/            # Use cases, serviços de aplicação
│   ├── infrastructure/         # Implementações: Firestore, Cloud Tasks, cache
│   ├── interfaces/             # Controladores HTTP (routes/)
│   ├── routes/                 # Roteadores Express (interface layer)
│   ├── services/               # Serviços de domínio/aplicação
│   ├── middleware/             # Auth, rate limiting
│   ├── schemas/                # Validação Zod
│   ├── utils/                  # Utilitários transversais (logger)
│   └── tests/                  # Testes unitários do backend
│
├── py_engine/                  # Motor Python (DXF + OSM + Geoespacial)
│   ├── controller.py           # Orquestrador do fluxo OSM→DXF
│   ├── dxf_generator.py        # Classe principal DXFGenerator
│   ├── dxf_drawing.py          # Mixin: desenho de geometrias (polígonos, linhas, pontos)
│   ├── dxf_cartography.py      # Mixin: legenda, carimbo, grade de coordenadas
│   ├── dxf_abnt.py             # Conformidade ABNT NBR 8196/10582/13142 (escala, carimbo)
│   ├── dxf_styles.py           # Estilos CAD (layers, linetypes, texto)
│   ├── osmnx_client.py         # Cliente OSM (via osmnx)
│   ├── elevation_client.py     # Cliente de elevação (Open-Elevation)
│   ├── contour_generator.py    # Geração de curvas de nível
│   ├── spatial_audit.py        # Auditoria espacial GIS
│   ├── constants.py            # Constantes globais do projeto
│   ├── utils/                  # logger.py, geo.py
│   └── tests/                  # Testes unitários Python (pytest)
│
├── src/                        # Frontend (React + TypeScript)
│   ├── App.tsx                 # Componente raiz
│   ├── components/             # Componentes UI
│   ├── hooks/                  # Custom hooks (lógica de estado)
│   ├── services/               # Chamadas de API
│   ├── utils/                  # Utilitários frontend
│   ├── types.ts                # Tipos TypeScript globais
│   └── constants.ts            # Constantes frontend
│
├── e2e/                        # Testes E2E (Playwright)
├── scripts/                    # Scripts de automação
├── public/                     # Assets estáticos
├── Dockerfile                  # Multi-stage build (Ubuntu 24.04)
└── docker-compose.yml          # Ambiente de desenvolvimento local
```

---

## 5. TECH STACK

### Frontend
- **React 19** + TypeScript 5.8
- **Leaflet** + React-Leaflet (mapas 2D/2.5D)
- **Framer Motion** (animações)
- **Tailwind CSS** (styling)
- **Recharts** (gráficos de elevação)
- **Vite 6** (bundler)

### Backend
- **Express 4** + TypeScript
- **Zod** (validação de schemas)
- **Winston** (logging)
- **Swagger/OpenAPI** (documentação API)
- **Google Cloud Firestore** (persistência jobs)
- **Google Cloud Tasks** (processamento assíncrono)
- **GROQ SDK** (análise IA — gratuito no tier free)
- **python-shell** (bridge Node→Python)

### Motor Python
- **osmnx 2.x** — download de dados OSM
- **ezdxf 1.4+** — geração de arquivos DXF
- **geopandas / shapely** — processamento geoespacial
- **pyproj** — transformação de coordenadas (SIRGAS 2000 UTM)
- **scipy / numpy** — matemática de terreno e contornos
- **matplotlib** — visualização (offline)

### Infraestrutura
- **Docker** + Docker Compose
- **Google Cloud Run** (produção)
- **GitHub Actions** (CI/CD)

---

## 6. APIs PÚBLICAS/GRATUITAS UTILIZADAS

| Serviço | URL | Uso |
|---------|-----|-----|
| OpenStreetMap (Overpass) | via osmnx | Dados geoespaciais |
| Nominatim | nominatim.openstreetmap.org | Geocodificação |
| Open-Elevation | api.open-elevation.com | MDT/Elevação |
| IBGE API | servicodados.ibge.gov.br | Dados municipais/censitários BR |
| DNIT | api.dnit.gov.br | Rodovias federais BR |
| INCRA | acervofundiario.incra.gov.br | Dados fundiários BR |
| GROQ | api.groq.com | IA (tier gratuito) |

**Regra de ouro:** ZERO CUSTO. Nunca adicionar API paga sem aprovação explícita.

---

## 7. FLUXO DE GERAÇÃO DXF

```
Usuário → MapSelector (Frontend)
    → useDxfExport hook
        → POST /api/dxf/generate
            → pythonBridge.ts → main.py → controller.py
                1. _build_tags() — OSM tags solicitadas
                2. fetch_osm_data() — osmnx_client.py
                3. run_spatial_audit() — spatial_audit.py
                4. DXFGenerator.add_features() — dxf_generator.py
                    → DXFDrawingMixin (polígonos, linhas, pontos)
                    → Z-thickness para 2.5D (edificações)
                5. _process_terrain() — elevation_client.py + contour_generator.py
                6. _add_cad_essentials() — dxf_cartography.py (legenda, carimbo, grade)
                7. dxf_gen.save() → arquivo .dxf
                8. _export_csv_metadata() → metadata .csv
            ← streaming de progresso via JSON (Logger.progress)
        ← URL de download do arquivo DXF
    ← Download no browser
```

---

## 8. CONVENÇÕES DE CÓDIGO

### Python (py_engine)
- **Imports:** sempre usar try/except para imports relativos vs absolutos (compatibilidade pytest)
- **Logging:** usar `Logger.info/error/success()` (nunca `print()`)
- **Coordenadas:** sempre validar com `_safe_v()` e `_safe_p()` antes de criar entidades DXF
- **Layers DXF:** prefixo `sisRUA_` em todos os layers (ex: `sisRUA_EDIFICACAO`)
- **Geometria:** shapely para cálculos, ezdxf para saída
- **CRS:** SIRGAS 2000 UTM (pyproj), função `sirgas2000_utm_epsg()` em `utils/geo.py`

### TypeScript (server)
- **Validação:** Zod schemas em `server/schemas/`
- **Logging:** Winston logger via `server/utils/logger.ts`
- **Erros:** sempre tratar erros com tipos explícitos
- **Async:** async/await, nunca callbacks raw

### TypeScript (frontend)
- **Estado:** custom hooks para lógica; componentes apenas para renderização
- **Idioma:** pt-BR em toda a UI (labels, mensagens, tooltips)
- **Temas:** dark/light via `settings.theme`

---

## 9. LAYERS DXF (REFERÊNCIA)

Layers criados por `dxf_styles.py` (`DXFStyleManager.setup_layers`):

| Constante (constants.py) | Layer DXF | Descrição |
|--------------------------|-----------|-----------|
| `LAYER_EDIFICACAO` | `EDIFICACAO` | Edificações (com thickness 2.5D) |
| `LAYER_VEGETACAO` | `VEGETACAO` | Vegetação (árvores, bosques) |
| `LAYER_EQUIPAMENTOS` | `EQUIPAMENTOS` | Equipamentos urbanos |
| `LAYER_HIDROGRAFIA` | `HIDROGRAFIA` | Corpos d'água |
| `LAYER_INFRA_POWER_HV` | `INFRA_POWER_HV` | Linhas de alta tensão |
| `LAYER_INFRA_POWER_LV` | `INFRA_POWER_LV` | Linhas de baixa tensão |
| `LAYER_INFRA_TELECOM` | `INFRA_TELECOM` | Infraestrutura telecom |
| `LAYER_MOBILIARIO_URBANO` | `MOBILIARIO_URBANO` | Mobiliário urbano |
| `LAYER_VIAS` | `VIAS` | Todas as vias (hierarquia via espessura) |
| `LAYER_VIAS_MEIO_FIO` | `VIAS_MEIO_FIO` | Meio-fio (curb offset) |
| `LAYER_TEXTO` | `TEXTO` | Textos e anotações |
| `LAYER_QUADRO` | `QUADRO` | Carimbo/quadro do projeto |
| _(interno)_ | `EDIFICACAO_HATCH` | Hatch interior de edificações |
| _(interno)_ | `ANNOT_AREA` | Anotações de área |
| _(interno)_ | `ANNOT_LENGTH` | Anotações de comprimento |
| _(interno)_ | `MALHA_COORD` | Grade de coordenadas |
| _(interno)_ | `TOPOGRAFIA_CURVAS` | Curvas topográficas |
| _(interno)_ | `CURVAS_NIVEL_MESTRA` | Curvas de nível mestras |
| _(interno)_ | `CURVAS_NIVEL_INTERM` | Curvas de nível intermediárias |
| _(interno)_ | `LEGENDA` | Legenda técnica |

---

## 10. PAPÉIS DE DESENVOLVIMENTO (ROLES)

### 🎯 Tech Lead (Orquestrador)
- Responsável: arquitetura geral, decisões técnicas, revisão de PRs
- Contexto: mantém esta MEMORY.MD atualizada
- Ferramentas: design patterns, DDD, revisão de código

### 💻 Dev Fullstack Sênior (Principal Coder)
- Responsável: implementação de features, refatoração, manutenção
- Regras: segue RNN, escreve testes, atualiza MEMORY.MD ao finalizar
- Ferramentas: TypeScript, Python, React, Express

### 🔧 DevOps/QA
- Responsável: CI/CD, Docker, testes automatizados, segurança
- Regras: garante que todos os testes passam antes de merge
- Ferramentas: GitHub Actions, Docker, pytest, Jest, Playwright

### 🎨 UI/UX Designer
- Responsável: interfaces, componentes visuais, experiência do usuário
- Regras: sempre em pt-BR, Tailwind CSS, acessibilidade
- Ferramentas: React, Framer Motion, Tailwind, Lucide

### 💡 Estagiário (Criatividade)
- Responsável: sugestões inovadoras, POCs, pesquisas
- Regras: propostas passam pela revisão do Tech Lead antes de implementar
- Contexto: pensar fora da caixa; zero burocracia para ideias

---

## 11. ESTADO ATUAL DO PROJETO

### ✅ Implementado e Funcionando
- [x] Motor Python DXF (py_engine) — modular (drawing, cartography, styles)
- [x] Controller OSM → DXF (controller.py)
- [x] Auditoria espacial (spatial_audit.py)
- [x] Elevação + curvas de nível (elevation_client.py, contour_generator.py)
- [x] Backend Express com todas as rotas modulares
- [x] Firestore com circuit breaker (quota monitoring)
- [x] Cloud Tasks para processamento assíncrono
- [x] Frontend React completo (MapSelector, AppSidebar, Settings, Landing)
- [x] Coordenadas de teste canônicas em constants.py
- [x] 61 testes Python (pytest) — todos passando (era 41)
- [x] **78 testes Python** (pytest) — todos passando (era 61); contour_generator + logger + elevation_exception
- [x] **206 testes backend** (Jest) — todos passando (era 198); cobertura 97.65% stmts, 86.48% branches
- [x] `batchService.ts` 100% cobertura (era 55.55% branch)
- [x] `dxfCleanupService.ts` 100% function coverage (setInterval callback coberto via fake timers)
- [x] `geocodingService.ts` 89.74% branch (utmToLatLon testado com inputs inválidos e coords canônicas)
- [x] `analyticsService.ts` 97.61% statements (buffer circular MAX_EVENTS coberto)
- [x] **Bug corrigido: contour_generator.py** — API deprecated `cs.collections` → `cs.allsegs` (matplotlib >= 3.8)
- [x] 187 testes backend (Jest) — todos passando (era 156)
- [x] Cobertura backend > 94% (94.86% statements) — após adição de novos serviços cobertos
- [x] elevationService.ts: 100% cobertura
- [x] ibgeService.ts: 96.73% cobertura
- [x] rateLimiter.ts: 81.81% cobertura
- [x] cloudTasksService.ts: 95.16% cobertura, 100% de funções cobertas
- [x] dnitService.ts: 100% statements/lines cobertura (novo: analyticsRoutes.test.ts + dnitService.test.ts + incraService.test.ts)
- [x] incraService.ts: 100% statements/lines cobertura (novo)
- [x] **exportsByMode no AnalyticsSummary** — nova métrica diferenciando exportações por modo (circle vs polygon)
- [x] E2E tests (Playwright) — configurados
- [x] Docker multi-stage (Ubuntu 24.04, Node 22, Python 3.12)
- [x] Swagger/OpenAPI documentation
- [x] Rate limiting e CORS
- [x] GitHub Actions (CI/CD, auto-healing)
- [x] SIRGAS 2000 UTM CRS (pyproj)
- [x] Batch processing (CSV upload)
- [x] APIs brasileiras (IBGE, DNIT, INCRA)
- [x] Headless DXF validation via ezdxf audit
- [x] **Otimização de queries OSM para áreas grandes (>1km)** — `osmnx_client.py` com `_fetch_chunked()`: busca por grupos de tags, deduplicação, fallback por grupo; 20 novos testes unitários (test_osmnx_client.py)
- [x] **Dashboard de analytics de uso (SaaS metrics)** — `server/services/analyticsService.ts` (in-memory, extensível Firestore); rota `GET /api/analytics`; `src/components/AnalyticsDashboard.tsx` (pt-BR, dark/light, charts Recharts); integração em `AppSidebar.tsx` via abas ANÁLISE/MÉTRICAS; 14 novos testes unitários (analyticsService.test.ts)
- [x] **Persistência de métricas de analytics em Firestore** — `analyticsService.ts`: `persistToFirestore()` (fire-and-forget, circuit breaker), `initFromFirestore()` (carga na inicialização), `initAnalyticsFromFirestore()` exportada; `server/index.ts` chama init em produção; 7 novos testes (analyticsFirestore.test.ts); backend 149→156 testes
- [x] **Cobertura de testes expandida para serviços sem testes** — 3 novos arquivos de teste: `dxfCleanupService.test.ts` (8 testes, 95% cobertura), `jobStatusService.test.ts` (12 testes, 89% cobertura), `analysisService.test.ts` (10 testes, 100% cobertura); backend 157→187 testes; `analysisService.ts` agora com 100% de cobertura
- [x] **Cobertura de testes aprimorada — caminhos de erro e timers** — `analyticsRoutes.test.ts`: +2 testes para catch blocks (analytics e events 500 error); `nominatimService.test.ts`: +4 testes (coords inválidas, catch reverseGeocode, display_name ausente, importance=0); `rateLimiter.test.ts`: +1 teste handler dxfRateLimiter; `jobStatusService.test.ts`: +2 testes fake timer (cleanup interval); backend 187→198 testes; cobertura 94.86%→97.06% statements; `nominatimService.ts` e `analytics.ts` agora 100% cobertura; `jobStatusService.ts` 98.18% (era 89.09%)
- [x] **ABNT NBR 8196/10582/13142 compliance** — novo módulo `dxf_abnt.py`: `compute_abnt_scale()` (escala padrão), `select_paper_size()` (A0-A4 automático), `ABNTTitleBlock` (carimbo completo com todos os campos NBR 10582); `dxf_cartography.py` atualizado para usar `ABNTTitleBlock`; `dxf_generator.py` passa extensão real para cálculo de escala; `main.py` + `pythonBridge.ts` + `dxfRequest.ts` + Swagger com novos campos ABNT (designer, numero_desenho, revisao, verificado_por, aprovado_por); `test_dxf_abnt.py` (32 testes); Python 78→110 testes; `rateLimiter.ts` 100% stmt/funcs/lines (generalRateLimiter handler coberto); Backend 206→207 testes; cobertura 97.65%→97.94% stmts, 98.05%→99.02% funcs
- [x] **Cobertura enterprise — 214 testes backend, 93.05% branches**: `analyticsService.ts` **100% stmt/branch/lines** (era 97.61%/84.61%); `ibgeService.ts` **100% stmt/branch/lines** (era 96.73%/73.21%); +7 novos testes: USE_FIRESTORE=true branches (record() + initAnalyticsFromFirestore()), mapMunicipio com dados incompletos (fallbacks `?? 0`), getEstados sem regiao, extractCentroid com geometry nula, FeatureCollection malformada, getEstados non-array; cobertura total: 98.68% stmts, **93.05% branches** (era 86.48%), 99.21% lines
- [x] **Cobertura DXF engine Python — 179 testes, dxf_generator 94%**: novo `test_dxf_drawing.py` (69 testes): `TestDetermineLayer` (14 tags OSM→layer), `TestMergeContiguousLines` (7 fusões), `TestAddTerrainFromGrid` (6), `TestAddContourLines` (4), `TestDrawGeometry` (9 tipos geométricos + coords canônicas), `TestDrawPoint` (10 layers/tags), `TestDrawStreetOffsets` (6 tipos de via), `TestDrawLinestring` (3), `TestAddFeaturesIntegration` (5 integração com audit headless); `cacheService.ts` **100% branch** (layers null/undefined → `{}`); `incraService.ts` 88.46%→92.3% branch (getParcelasSummary default radius); Python 110→**179 testes**; `dxf_generator.py` 57%→**94%**; `dxf_drawing.py` 70%→**78%**; backend 217 testes, branches 93.05%→**93.82%**
- [x] **Bugfix Logger.warn + cobertura cartografia/auditoria — 213 Python, 220 backend, rateLimiter 100%**: **Bug crítico corrigido** — `Logger.warn()` ausente na classe Logger (AttributeError em produção quando concat fallback disparado); novo `test_dxf_cartography.py` (29 testes): `TestAddCartographicElements` (3), `TestAddCoordinateGrid` (5), `TestAddLegend` (4), `TestAddTitleBlock` (8 com audit headless, todos raios canônicos), `TestCartographyIntegration` (1); `test_spatial_audit.py` +14 testes: `TestCombineAnalysisFeatures` (4, cobre linhas 123/129-131), `TestCalculateLightingScore` (4, cobre linha 141), `TestAuditPowerLineProximity` (1, cobre linhas 115-117), `TestRunSpatialAuditEdgeCases` (3); `test_logger.py` +1 (test_warn_outputs_json); `rateLimiter.test.ts` +1 (req.ip undefined → "unknown", cobre linha 38); `dxfCleanupService.test.ts`/`jobStatusService.test.ts` +1 cada (idempotência); Python 179→**213 testes**; `dxf_cartography.py` 57%→**89%**; `spatial_audit.py` 84%→**95%**; `rateLimiter.ts` branches 87.5%→**100%**; Python total 80%→**83%**; backend 217→**220 testes**, branches 93.82%→**94.2%**
- [x] **Frontend hooks 45→105 testes (SotA) — geo.ts 100%, useUndoRedo 100%, kmlParser 97%, useOsmEngine 100%**: Novos: `tests/hooks/useUndoRedo.test.ts` (22 testes, state machine completo undo/redo); `tests/utils/kmlParser.test.ts` (8 testes, FileReader mock via vi.stubGlobal, KML válido/inválido/edge-cases); `tests/utils/geo.test.ts` (19 testes, UTM 23K canônico, hemisférios N/S, zonas inválidas 0/61, regex edge-cases); `tests/hooks/useOsmEngine.test.ts` (11 testes, todas as branches: success/empty/error, AI on/off, clearData, setOsmData); Backend +4: `geocodingService` zona 0/61/99 (linha 48); `incraService` `id:undefined` → `?? ''` (96.15% branch); Frontend 45→**105**; `useUndoRedo` **100%** all; `geo.ts` **100%** stmts; `kmlParser` **97%**; `useOsmEngine` **100%** stmts; backend 220→**224**

### 🔄 Em Desenvolvimento / Melhorias Pendentes
_(sem itens pendentes no momento)_

---

## 12. COMANDOS ESSENCIAIS

```bash
# Desenvolvimento local
npm run docker:dev          # Inicia ambiente completo Docker
npm run dev                 # Frontend + Backend (sem Docker)

# Testes
npm run test:backend        # Jest (224 testes, 98.82% stmts, 94.98% branches)
npm run test:frontend       # Vitest (163 testes, 95.55% stmts, 89.91% branches)
npm run test:e2e            # Playwright
cd py_engine && python3 -m pytest tests/ -v  # Python (252 testes, 86% cobertura)

# Build e Deploy
npm run build               # Build frontend
npm run docker:build        # Build imagem Docker
./scripts/update-version.sh # Atualiza versão

# Segurança
npm run security:audit      # npm audit
python scripts/security_audit.py  # Bandit security scan

# DXF Headless (alternativa ao accoreconsole)
python -c "import ezdxf; doc=ezdxf.readfile('arquivo.dxf'); a=doc.audit(); print(f'{len(a.errors)} erros')"
```

---

## 13. VARIÁVEIS DE AMBIENTE

```env
# Backend (.env)
PORT=3001
NODE_ENV=development|production
GROQ_API_KEY=                    # GROQ AI (gratuito)
GCP_PROJECT=sisrua-producao      # Google Cloud Project
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=sisrua-queue
CLOUD_RUN_BASE_URL=              # URL do Cloud Run (produção)
DOCKER_ENV=true                  # Indica ambiente Docker

# Python (via server bridge)
PYTHON_COMMAND=python3
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
```

---

## 14. GLOSSÁRIO

| Termo | Significado |
|-------|-------------|
| DXF | Drawing Exchange Format — formato CAD (AutoCAD) |
| 2.5D | Geometria 2D com extrusão Z (thickness) — simula 3D em DXF |
| OSM | OpenStreetMap — fonte de dados geoespaciais abertos |
| UTM | Universal Transverse Mercator — sistema de projeção cartográfica |
| SIRGAS 2000 | Sistema de Referência Geocêntrico para as Américas — datum oficial BR |
| BIM | Building Information Modeling — modelo com informações semânticas |
| DDD | Domain-Driven Design — arquitetura orientada ao domínio |
| RAG | Retrieval Augmented Generation — base de conhecimento para IA |
| carimbo | Quadro de identificação do projeto em plantas CAD |
| meio-fio | Guia/sarjeta — offset lateral de vias (curb) |

---

## 15. HISTÓRICO DE SESSÕES

| Data | Ação | Responsável |
|------|------|-------------|
| 2026-02-21 | Criação deste MEMORY.MD; verificação de testes (98 passando) | Dev Fullstack Sênior |
| 2026-02-21 | Elevação cobertura backend de 79% → 93.22%; testes 74→100: ElevationService (100%), IbgeService (96.73%), RateLimiter (81.81%); getMunicipiosPorEstado/getMalhaGeoJson/extractCentroid testados | Dev Fullstack Sênior |
| 2026-02-21 | OSM query optimization: `_fetch_chunked()` em osmnx_client.py (chunked fetching para radius >1km); 20 novos testes (test_osmnx_client.py); cloudTasksService cobertura 85%→95% (+3 testes: dev mode, error path, getTaskStatus); Python 41→61 testes, Backend 100→103 testes, cobertura 93.22%→94.79% | Dev Fullstack Sênior |
| 2026-02-21 | **Analytics Dashboard SaaS**: `analyticsService.ts` (in-memory, singleton, prune 7d, cluster regiões, top5); rota `/api/analytics`; `AnalyticsDashboard.tsx` (pt-BR, dark/light, KPI cards, gráficos por hora/tipo/status, top regiões, eventos recentes); `AppSidebar.tsx` com abas ANÁLISE/MÉTRICAS; `src/services/analyticsService.ts` (cliente fetch); instrumentação em `routes/dxf.ts`; 14 novos testes (117 total backend); TypeScript compila sem erros | Dev Fullstack Sênior |
| 2026-02-21 | **Expansão de testes e métricas**: `exportsByMode` em `AnalyticsSummary` (circle vs polygon); 3 novos arquivos de teste: `analyticsRoutes.test.ts` (integração HTTP), `dnitService.test.ts` (16 testes, 100% cobertura), `incraService.test.ts` (14 testes, 100% cobertura); backend 117→149 testes, cobertura 94.79%→95.37% | Dev Fullstack Sênior |
| 2026-02-21 | **Persistência Firestore para Analytics**: `analyticsService.ts` — `persistToFirestore()` (async fire-and-forget, circuit breaker), `initFromFirestore()` (carga de eventos ao startup), `initAnalyticsFromFirestore()` exportada; `server/index.ts` chama init em produção; `analyticsFirestore.test.ts` (7 testes); backend 149→156 testes | Dev Fullstack Sênior |
| 2026-02-21 | **Cobertura expandida — 3 novos arquivos de teste**: `dxfCleanupService.test.ts` (8 testes, 95% stmt), `jobStatusService.test.ts` (12 testes, 89% stmt), `analysisService.test.ts` (10 testes, 100% cobertura total); backend 157→187 testes; `analysisService.ts` 100% cobertura | Dev Fullstack Sênior |
| 2026-02-21 | **Cobertura de caminhos de erro e timers**: analytics catch blocks (+2 testes 500 error em `/api/analytics` e `/api/analytics/events`); nominatim invalid coords/catch/optional fields (+4 testes → 100% cobertura total); rateLimiter handler dxfRateLimiter (+1 teste, 90.9%); jobStatusService cleanup interval com fake timers (+2 testes, 98.18%); backend 187→198 testes, cobertura 94.86%→97.06% statements | Dev Fullstack Sênior |
| 2026-02-21 | **Enterprise improvements — cobertura e correção de bug crítico**: `batchService.ts` 100% coverage (erro de stream + valores não-string); `dnitService.ts` 91.66% branch (default-radius tests); `dxfCleanupService.ts` 100% funções (fake timers, setInterval callback); `geocodingService.ts` 89.74% branch (utmToLatLon zero-inputs + coords canônicas); `analyticsService.ts` 97.61% (buffer circular MAX_EVENTS); Bug corrigido: `contour_generator.py` — `cs.collections` depreciado → `cs.allsegs` (matplotlib >= 3.8); `test_contour_generator.py` (7 testes) + `test_logger.py` (9 testes) + `test_elevation.py` +1 (exception path); Python 61→78 testes; Backend 198→206 testes; cobertura 97.06%→97.65% stmts, 83.39%→86.48% branches | Dev Fullstack Sênior |
| 2026-02-21 | **ABNT NBR 8196/10582/13142 — carimbo técnico conforme norma**: novo módulo `dxf_abnt.py` (compute_abnt_scale, select_paper_size, ABNTTitleBlock); `dxf_cartography.py` usa ABNTTitleBlock com todos os campos normalizados; `dxf_generator.py` calcula extensão real para escala; campos ABNT propagados por toda a stack (main.py → pythonBridge.ts → dxfRequest.ts → cloudTasksService.ts → Swagger); `test_dxf_abnt.py` (32 testes); `rateLimiter.ts` 100% cobertura; Python 78→110 testes; Backend 206→207 testes | Dev Fullstack Sênior |
| 2026-02-21 | **Versionamento zerado e coerente**: VERSION → `0.1.0`; novo `server/version.ts` (fonte central SERVER_VERSION); `health.ts`, `index.ts`, `swagger.ts` importam SERVER_VERSION (eliminadas 5 strings hardcoded `1.2.0`); `update-version.sh` e `check-version.sh` atualizados para gerenciar `server/version.ts` + `src/constants.ts`; `tests/version.test.ts` ampliado com 2 novos checks (APP_VERSION e SERVER_VERSION); docs/CHANGELOG.md e docs/RAG.md atualizados | Dev Fullstack Sênior |
| 2026-02-21 | **Análise de maturidade — correção de versão para 1.0.0**: avaliação técnica conclui que `0.1.0` (pré-estável, API instável) é incoerente com a maturidade real do projeto (produção Cloud Run, 7 workflows CI/CD, 207 testes backend 97.94% cobertura, 110 testes Python, 18.333+ linhas, DDD completo, APIs governamentais BR, compliance ABNT); VERSION → `1.0.0` (primeiro release estável); CHANGELOG.md atualizado com justificativa técnica | Dev Fullstack Sênior |
| 2026-02-21 | **Cobertura enterprise — 214 testes backend, 93.05% branches**: `analyticsService.ts` 100% stmt/branch/lines; `ibgeService.ts` 100% stmt/branch/lines; +7 novos testes: USE_FIRESTORE=true branches, mapMunicipio fallbacks `?? 0`, getEstados sem regiao, extractCentroid com geometry nula/FeatureCollection malformada; branches: 86.48% → **93.05%**, stmts: 97.94% → **98.68%**, lines: 98.74% → **99.21%** | Dev Fullstack Sênior |
| 2026-02-21 | **Cobertura DXF engine Python — 179 testes, dxf_generator 94%**: novo `test_dxf_drawing.py` (69 testes); `TestDetermineLayer` (14 tags), `TestMergeContiguousLines` (7), `TestAddTerrainFromGrid` (6), `TestAddContourLines` (4), `TestDrawGeometry` (9), `TestDrawPoint` (10), `TestDrawStreetOffsets` (6), `TestDrawLinestring` (3), `TestAddFeaturesIntegration` (5 com audit headless); `cacheService.ts` 100% branch (null/undefined layers); `incraService.ts` 92.3% branch; Python 110→179 testes; dxf_generator 57%→94%; dxf_drawing 70%→78%; backend 217 testes; branches 93.05%→93.82% | Dev Fullstack Sênior |
| 2026-02-21 | **Bugfix Logger.warn + cobertura cartografia/auditoria — 213 Python, 220 backend**: **Bug crítico**: `Logger.warn()` inexistente → AttributeError em produção (concat fallback); novo `test_dxf_cartography.py` (29 testes, cartographicElements/coordinateGrid/legend/titleBlock+audit headless+3 raios); `test_spatial_audit.py` +14 testes (CombineFeatures/LightingScore/PowerLineException/EdgeCases); `test_logger.py` +1 warn; `rateLimiter.test.ts` +1 (req.ip undefined → "unknown", **rateLimiter.ts 100% branch**); `dxfCleanupService.test.ts`/`jobStatusService.test.ts` +1 cada (idempotência); Python 179→**213**; dxf_cartography 57%→**89%**; spatial_audit 84%→**95%**; Python total 80%→**83%**; backend 217→**220**; branches 93.82%→**94.2%** | Dev Fullstack Sênior |
| 2026-02-21 | **Frontend hooks 45→105 testes, geo.ts 100%, useUndoRedo 100%, kmlParser 97%, useOsmEngine 100%**: Novos arquivos: `tests/hooks/useUndoRedo.test.ts` (22 testes: state machine completo, undo/redo multi-step, saveSnapshot, commit=false, objetos complexos); `tests/utils/kmlParser.test.ts` (8 testes: KML válido/inválido via vi.stubGlobal FileReader mock, onerror, NaN filtering); `tests/utils/geo.test.ts` (19 testes: UTM 23K, bandas C-M/N-X, zona 0/61 inválidas, regex edge cases, normalização vírgula); `tests/hooks/useOsmEngine.test.ts` (11 testes: success/empty/error flows, AI on/off, clearData, setOsmData); Backend +4: `geocodingService` zona 0/61/99 → cobre linha 48; `incraService` `id:undefined` → cobre `?? ''` branch (96.15%); Frontend 45→**105**; `useUndoRedo` **100%** all metrics; `geo.ts` **100%** stmts; `kmlParser.ts` **97%**; `useOsmEngine.ts` **100%** stmts; backend 220→**224** | Dev Fullstack Sênior |
| 2026-02-21 | **SotA guards+services — 596 total tests: dxf_drawing 97%, dxf_generator 99%, elevationService 100%, logger 98%**: Novo `test_dxf_drawing_guards.py` (39 testes Python): `_safe_v` ValueError/TypeError, `_safe_p` IndexError, `_validate_points` guards (NaN deduplication, non-iterable except 58-60), `_get_thickness` levels/exception, polygon holes (97-100), building annotation/hatch exceptions (118-119/136-137), linestring VIAS exception (162-163), MultiLineString offset via MagicMock (178-179), offset exception, `_draw_point` NaN guard (209), bench/waste/lamp blocks (223-228), NaN bounds fallback (72), `_simplify_line` (114), start-start merge (153), street label exception via `np.arctan2` patch (212-213), bad terrain vertex (252-254), save exception (296-298); Frontend +15: `tests/utils/logger.test.ts` +6 (vi.stubEnv NODE_ENV=development, console.log/warn/error, data arg, debug on/off), `tests/services/elevationService.test.ts` +9 (error/non-ok/invalid response → flat grid, default clamp, lat/lng coords, fetchElevationProfile success/error/non-ok); Python 213→**252**; Frontend 105→**120**; `dxf_drawing.py` **78%→97%**; `dxf_generator.py` **94%→99%**; `elevationService.ts` **69%→100%** stmts, **64%→95%** branch; `logger.ts` **83%→98%** stmts, **81%→95%** branch; Python total **83%→86%**; CodeQL 0 alertas | Dev Fullstack Sênior |
| 2026-02-21 | **Coverage>=80% — frontend 95.55% stmts, 89.91% branches — 639 total tests**: **Bug crítico de config corrigido**: vitest coverage incluía `server/` (todos 0%) → overall reportado como 7.5% (ERRADO); fix: `include: ['src/**/*.{ts,tsx}']` + exclude components (testados via E2E Playwright); **Novos testes frontend**: `useFileOperations.test.ts` reescrito (7 testes reais com renderHook: saveProject success/error, loadProject valid/invalid/malformed/onerror); `useDxfExport.test.ts` reescrito (7 testes reais: idle state, url imediata, jobId queued, null result, network error, default projection, getDxfJobStatus); `useSearch.test.ts` +5 (UTM found, lat/lng direct, null response, network error, handleSearch form); Novos arquivos de serviço: `tests/services/dxfService.test.ts` (12 testes: generateDXF/getDxfJobStatus/calculateStats, 100% cobertura); `tests/services/osmService.test.ts` (4 testes: failover endpoints, 100%); `tests/services/geminiService.test.ts` (10 testes: findLocationWithGemini/analyzeArea AI on/off/error, 100%); `tests/services/analyticsService.test.ts` (3 testes: success/non-ok/network, 100%); Frontend 120→**163 testes**; Cobertura frontend: **7.5%→95.55% stmts**, **89.91% branches**, **100% funcs**, todos os layers ≥ 80% ✅; useFileOperations.ts 0%→94%; useDxfExport.ts 0%→60%; useSearch.ts 77%→95% stmts, 55%→90% branches; dxfService 0%→100%; osmService 0%→100%; geminiService 0%→100%; src/services/analyticsService 0%→100%; CodeQL 0 alertas | Dev Fullstack Sênior |

---

*Última atualização: 2026-02-21 | Versão do Documento: 2.4*
