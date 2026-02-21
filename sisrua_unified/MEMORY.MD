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

### 🔄 Em Desenvolvimento / Melhorias Pendentes
_(sem itens pendentes no momento)_

---

## 12. COMANDOS ESSENCIAIS

```bash
# Desenvolvimento local
npm run docker:dev          # Inicia ambiente completo Docker
npm run dev                 # Frontend + Backend (sem Docker)

# Testes
npm run test:backend        # Jest (187 testes, >94% cobertura)
npm run test:frontend       # Vitest
npm run test:e2e            # Playwright
cd py_engine && python -m pytest tests/ -v  # Python (61 testes)

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

---

*Última atualização: 2026-02-21 | Versão do Documento: 1.3*
