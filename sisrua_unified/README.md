# SIS RUA Unified - Sistema de Exportação OSM para DXF

Sistema completo de extração de dados do OpenStreetMap e geração de arquivos DXF 2.5D para AutoCAD, com suporte a análise espacial e coordenadas UTM absolutas.

## 📁 Estrutura do Projeto

```
sisrua_unified/
├── src/                      # Frontend (React + TypeScript)
│   ├── components/          # Componentes React
│   │   ├── Dashboard.tsx
│   │   ├── MapSelector.tsx
│   │   ├── SettingsModal.tsx
│   │   └── ...
│   ├── hooks/              # Custom React Hooks
│   │   ├── useOsmEngine.ts
│   │   ├── useDxfExport.ts
│   │   ├── useFileOperations.ts
│   │   └── ...
│   ├── services/           # API clients
│   │   ├── osmService.ts
│   │   ├── dxfService.ts
│   │   └── ...
│   ├── utils/              # Utilitários
│   │   ├── logger.ts
│   │   ├── kmlParser.ts
│   │   └── ...
│   ├── App.tsx             # Componente principal
│   ├── index.tsx           # Entry point
│   ├── types.ts            # Type definitions
│   └── constants.ts        # Constantes
│
├── server/                  # Backend Node.js (Express)
│   ├── services/           # Serviços backend
│   ├── index.ts            # Servidor Express
│   └── pythonBridge.ts     # Bridge para Python
│
├── py_engine/              # Motor Python (OSMnx + ezdxf)
│   ├── main.py             # Entry point Python
│   ├── controller.py       # Orquestração
│   ├── osmnx_client.py     # Cliente OSM
│   ├── dxf_generator.py    # Geração DXF
│   ├── constants.py        # Constantes Python
│   └── utils/              # Utilitários Python
│
├── tests/                   # Testes automatizados
│   ├── setup.ts            # Configuração Vitest
│   ├── hooks/              # Testes de hooks
│   ├── utils/              # Testes de utilities
│   └── constants.test.ts
│
├── public/                  # Assets estáticos
│   ├── dxf/                # DXFs gerados
│   └── theme-override.css
│
├── test_files/             # Arquivos de teste (DXF, CSV)
├── docs/                   # Documentação
│   ├── AUDIT_REPORT.md     # Relatório de auditoria
│   └── README.md           # Docs antigas
├── scripts/                # Scripts utilitários
│   ├── audit_dxf.py
│   ├── test_fix.py
│   └── ...
│
├── cache/                  # Cache de requisições
├── build/                  # Build artifacts
├── dist/                   # Distribution files
│
├── index.html              # HTML principal
├── package.json            # Dependências Node
├── tsconfig.json           # Config TypeScript
├── vite.config.ts          # Config Vite
└── start-dev.ps1           # Script de inicialização
```

## 🚀 Como Usar

### Instalação
```bash
npm install
pip install -r py_engine/requirements.txt
```

### Desenvolvimento
```bash
npm run dev
```
Isso inicia:
- Frontend em http://localhost:3000
- Backend em http://localhost:3001

### Testes
```bash
npm run test              # Todos os testes
npm run test:frontend     # Apenas frontend
```

### Build
```bash
npm run build
```

## 🎯 Funcionalidades

- ✅ Busca de localização com AI (GROQ) e UTM
- ✅ Seleção de área (círculo/polígono)
- ✅ Importação KML
- ✅ Exportação DXF com coordenadas UTM absolutas
- ✅ Análise espacial automatizada
- ✅ Perfis de elevação
- ✅ Sistema de camadas configurável
- ✅ Undo/Redo
- ✅ Salvamentos de projeto

## 📊 Coordenadas

O sistema suporta dois modos de projeção:

- **UTM (Absoluto)**: Coordenadas UTM reais compatíveis com Google Earth, GPS e GIS profissionais
- **Local (Relativo)**: Coordenadas centradas em (0,0) para desenhos CAD tradicionais

## 🧪 Testes

- **32 testes** frontend (100% passando)
- Vitest + React Testing Library
- Cobertura de código com V8

## 📝 Licença

Proprietary
