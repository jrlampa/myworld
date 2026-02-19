# ✅ Checklist de Implementação - Correções de Auditoria

**Baseado em**: AUDITORIA_TECNICA_COMPLETA.md  
**Data de Criação**: 19/02/2026  
**Objetivo**: Guia prático passo-a-passo para implementar as correções identificadas

---

## 🔴 FASE 1: CRÍTICO (Prazo: 1-2 dias)

### Issue #1: Implementar Autenticação OIDC no Webhook

**Arquivo**: `sisrua_unified/server/index.ts` (linha 252)

- [ ] **Passo 1**: Instalar dependência
  ```bash
  cd sisrua_unified
  npm install google-auth-library
  ```

- [ ] **Passo 2**: Criar função de verificação
  ```typescript
  // Adicionar em server/middleware/auth.ts (criar arquivo)
  import { OAuth2Client } from 'google-auth-library';
  import { Request, Response, NextFunction } from 'express';
  
  const client = new OAuth2Client();
  
  export async function verifyCloudTasksToken(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.CLOUD_RUN_SERVICE_URL
      });
      
      const payload = ticket.getPayload();
      
      // Verificar service account esperado
      if (payload?.email !== process.env.GCP_SERVICE_ACCOUNT) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Invalid service account'
        });
      }
      
      next();
    } catch (error) {
      logger.error('OIDC verification failed', error);
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }
  }
  ```

- [ ] **Passo 3**: Aplicar middleware no endpoint
  ```typescript
  // Em server/index.ts, linha 252
  import { verifyCloudTasksToken } from './middleware/auth.js';
  
  app.post('/api/tasks/process-dxf', 
    verifyCloudTasksToken,  // <-- Adicionar esta linha
    async (req, res) => {
      // ... resto do código
    }
  );
  ```

- [ ] **Passo 4**: Adicionar variáveis de ambiente
  ```bash
  # Em .env
  CLOUD_RUN_SERVICE_URL=https://[seu-servico].run.app
  GCP_SERVICE_ACCOUNT=[service-account]@[project].iam.gserviceaccount.com
  ```

- [ ] **Passo 5**: Testar localmente
  ```bash
  npm run build
  npm run server
  # Tentar chamar o endpoint sem token (deve retornar 401)
  curl -X POST http://localhost:8080/api/tasks/process-dxf
  ```

- [ ] **Passo 6**: Testar em staging
  ```bash
  # Deploy para staging
  git checkout -b fix/oidc-validation
  git add .
  git commit -m "feat: Add OIDC validation to Cloud Tasks webhook"
  git push origin fix/oidc-validation
  # Criar PR e fazer deploy em staging
  ```

**Tempo Estimado**: 2 horas  
**Prioridade**: 🔴 CRÍTICA

---

### Issue #2: Atualizar Dependências com Vulnerabilidades

**Arquivo**: `sisrua_unified/package.json`

- [ ] **Passo 1**: Fazer backup do package-lock.json
  ```bash
  cd sisrua_unified
  cp package-lock.json package-lock.json.backup
  ```

- [ ] **Passo 2**: Tentar correção automática
  ```bash
  npm audit fix
  ```

- [ ] **Passo 3**: Verificar resultado
  ```bash
  npm audit
  # Verificar se vulnerabilidades HIGH/CRITICAL foram corrigidas
  ```

- [ ] **Passo 4**: Atualizar deps dev manualmente se necessário
  ```bash
  npm install eslint@latest --save-dev
  npm install jest@latest --save-dev
  npm install @vitest/coverage-v8@latest --save-dev
  ```

- [ ] **Passo 5**: Testar build
  ```bash
  npm run build
  npm run test:backend
  npm run test:frontend
  ```

- [ ] **Passo 6**: Verificar compatibilidade
  ```bash
  # Se houver erros, verificar breaking changes
  # Ajustar código conforme necessário
  ```

- [ ] **Passo 7**: Commitar mudanças
  ```bash
  git add package.json package-lock.json
  git commit -m "chore: Update dependencies to fix security vulnerabilities"
  ```

**Tempo Estimado**: 2 horas  
**Prioridade**: 🔴 CRÍTICA

---

### Issue #3: Remover Exposição de API Key

**Arquivo**: `sisrua_unified/server/index.ts` (linha 232)

- [ ] **Passo 1**: Localizar o código problemático
  ```bash
  cd sisrua_unified
  grep -n "groqApiKey.substring" server/index.ts
  # Deve mostrar linha ~232
  ```

- [ ] **Passo 2**: Editar o arquivo
  ```typescript
  // ANTES (LINHA 232):
  groqApiKey: groqApiKey ? {
    configured: true,
    prefix: groqApiKey.substring(0, 7)  // ⚠️ REMOVER ESTA LINHA
  } : { configured: false }
  
  // DEPOIS:
  groqApiKey: groqApiKey ? {
    configured: true
    // prefix removido por segurança
  } : { configured: false }
  ```

- [ ] **Passo 3**: Testar endpoint /health
  ```bash
  npm run server
  curl http://localhost:8080/health | jq
  # Verificar que 'prefix' não aparece mais
  ```

- [ ] **Passo 4**: Commitar
  ```bash
  git add server/index.ts
  git commit -m "security: Remove GROQ API key prefix exposure from health endpoint"
  ```

**Tempo Estimado**: 30 minutos  
**Prioridade**: 🔴 CRÍTICA

---

## 🟠 FASE 2: ALTO (Prazo: 1 semana)

### Issue #4: Implementar Autenticação por API Key

- [ ] **Passo 1**: Criar schema de API keys
  ```typescript
  // server/models/apiKey.ts
  export interface ApiKey {
    key: string;
    userId: string;
    name: string;
    createdAt: Date;
    expiresAt?: Date;
    rateLimit: {
      requests: number;
      windowMs: number;
    };
  }
  ```

- [ ] **Passo 2**: Criar middleware de autenticação
  ```typescript
  // server/middleware/requireApiKey.ts
  import { Request, Response, NextFunction } from 'express';
  import crypto from 'crypto';
  
  // Em produção, usar Firestore ou database
  const API_KEYS = new Map<string, ApiKey>();
  
  export function requireApiKey(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): void {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required',
        message: 'Include X-API-Key header'
      });
    }
    
    const keyData = API_KEYS.get(apiKey);
    
    if (!keyData) {
      return res.status(401).json({ 
        error: 'Invalid API key'
      });
    }
    
    if (keyData.expiresAt && keyData.expiresAt < new Date()) {
      return res.status(401).json({ 
        error: 'API key expired'
      });
    }
    
    // Anexar dados do usuário ao request
    req.user = {
      userId: keyData.userId,
      apiKeyName: keyData.name
    };
    
    next();
  }
  ```

- [ ] **Passo 3**: Aplicar em endpoints sensíveis
  ```typescript
  // server/index.ts
  import { requireApiKey } from './middleware/requireApiKey.js';
  
  app.post('/api/dxf', requireApiKey, dxfRateLimiter, handleDxfRequest);
  app.post('/api/batch/dxf', requireApiKey, handleBatchDxf);
  app.post('/api/analyze', requireApiKey, handleAnalyze);
  ```

- [ ] **Passo 4**: Criar endpoint de geração de API keys
  ```typescript
  app.post('/api/admin/keys', adminAuth, async (req, res) => {
    const apiKey = crypto.randomBytes(32).toString('hex');
    // Salvar no banco
    res.json({ apiKey });
  });
  ```

- [ ] **Passo 5**: Documentar no README
  ```markdown
  ## API Authentication
  
  All API endpoints require authentication via API key.
  
  Include the key in the `X-API-Key` header:
  
  ```bash
  curl -X POST https://api.example.com/api/dxf \
    -H "X-API-Key: your-api-key-here" \
    -H "Content-Type: application/json" \
    -d '{"polygon": [...], "layers": {...}}'
  ```
  ```

**Tempo Estimado**: 1 dia  
**Prioridade**: 🟠 ALTA

---

### Issue #5: Adicionar Rate Limiting ao Webhook

- [ ] **Passo 1**: Criar rate limiter específico
  ```typescript
  // server/index.ts
  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 20, // 20 requests por minuto
    message: 'Too many webhook requests',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Não aplicar em desenvolvimento
      return process.env.NODE_ENV !== 'production';
    }
  });
  ```

- [ ] **Passo 2**: Aplicar no endpoint
  ```typescript
  app.post('/api/tasks/process-dxf', 
    webhookLimiter,
    verifyCloudTasksToken,
    async (req, res) => {
      // ... código
    }
  );
  ```

- [ ] **Passo 3**: Testar
  ```bash
  # Script de teste
  for i in {1..25}; do
    curl -X POST http://localhost:8080/api/tasks/process-dxf
  done
  # Deve retornar 429 após 20 requests
  ```

**Tempo Estimado**: 1 hora  
**Prioridade**: 🟠 ALTA

---

### Issue #6: Adicionar Validação Zod Completa

- [ ] **Passo 1**: Criar schemas
  ```typescript
  // server/schemas/dxf.ts
  import { z } from 'zod';
  
  export const polygonSchema = z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(
      z.array(
        z.tuple([
          z.number().min(-180).max(180), // longitude
          z.number().min(-90).max(90)    // latitude
        ])
      )
    ).max(1000) // Máximo 1000 pontos
  });
  
  export const layersSchema = z.object({
    buildings: z.boolean().optional(),
    roads: z.boolean().optional(),
    water: z.boolean().optional(),
    landuse: z.boolean().optional(),
    railways: z.boolean().optional()
  }).strict(); // Não permitir campos extras
  
  export const dxfRequestSchema = z.object({
    polygon: polygonSchema,
    layers: layersSchema,
    projectName: z.string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Only alphanumeric, underscore, hyphen'),
    includeElevation: z.boolean().optional()
  });
  ```

- [ ] **Passo 2**: Criar middleware de validação
  ```typescript
  // server/middleware/validate.ts
  import { z, ZodError } from 'zod';
  
  export function validate(schema: z.ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof ZodError) {
          return res.status(400).json({
            error: 'Validation failed',
            details: error.errors
          });
        }
        next(error);
      }
    };
  }
  ```

- [ ] **Passo 3**: Aplicar validação
  ```typescript
  import { validate } from './middleware/validate.js';
  import { dxfRequestSchema } from './schemas/dxf.js';
  
  app.post('/api/dxf', 
    requireApiKey,
    validate(dxfRequestSchema),
    dxfRateLimiter,
    handleDxfRequest
  );
  ```

- [ ] **Passo 4**: Testar validação
  ```bash
  # Testar com dados inválidos
  curl -X POST http://localhost:8080/api/dxf \
    -H "X-API-Key: test-key" \
    -H "Content-Type: application/json" \
    -d '{"polygon": "invalid", "layers": {}}'
  # Deve retornar 400 com detalhes do erro
  ```

**Tempo Estimado**: 3 horas  
**Prioridade**: 🟠 ALTA

---

### Issue #7: Migrar Job Status para Firestore

- [ ] **Passo 1**: Instalar dependência
  ```bash
  npm install @google-cloud/firestore
  ```

- [ ] **Passo 2**: Criar service
  ```typescript
  // server/services/jobStatusService.ts
  import { Firestore } from '@google-cloud/firestore';
  
  const db = new Firestore();
  const jobsCollection = db.collection('jobs');
  
  export async function createJob(jobData: JobData): Promise<string> {
    const jobRef = await jobsCollection.add({
      ...jobData,
      createdAt: Firestore.FieldValue.serverTimestamp(),
      updatedAt: Firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });
    return jobRef.id;
  }
  
  export async function updateJobStatus(
    jobId: string, 
    status: JobStatus
  ): Promise<void> {
    await jobsCollection.doc(jobId).update({
      ...status,
      updatedAt: Firestore.FieldValue.serverTimestamp()
    });
  }
  
  export async function getJobStatus(
    jobId: string
  ): Promise<JobStatus | null> {
    const doc = await jobsCollection.doc(jobId).get();
    return doc.exists ? doc.data() as JobStatus : null;
  }
  
  export async function cleanupOldJobs(): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oldJobs = await jobsCollection
      .where('createdAt', '<', oneHourAgo)
      .get();
    
    const batch = db.batch();
    oldJobs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  ```

- [ ] **Passo 3**: Substituir Map por Firestore
  ```typescript
  // Substituir todas as chamadas:
  // jobs.set(id, data) -> await createJob(data)
  // jobs.get(id) -> await getJobStatus(id)
  // jobs.delete(id) -> await deleteJob(id)
  ```

- [ ] **Passo 4**: Configurar índices
  ```bash
  # Criar firestore.indexes.json
  {
    "indexes": [
      {
        "collectionGroup": "jobs",
        "queryScope": "COLLECTION",
        "fields": [
          { "fieldPath": "status", "order": "ASCENDING" },
          { "fieldPath": "createdAt", "order": "DESCENDING" }
        ]
      }
    ]
  }
  ```

- [ ] **Passo 5**: Deploy índices
  ```bash
  gcloud firestore indexes create --project=$GCP_PROJECT_ID
  ```

**Tempo Estimado**: 4 horas  
**Prioridade**: 🟠 ALTA

---

### Issue #8: Limitar Body Size por Endpoint

- [ ] **Passo 1**: Configurar limites específicos
  ```typescript
  // server/index.ts
  
  // Limite geral (para a maioria dos endpoints)
  app.use(express.json({ limit: '1mb' }));
  
  // Limite maior apenas para upload de CSV
  app.post('/api/batch/dxf',
    express.json({ limit: '5mb' }),
    requireApiKey,
    handleBatchDxf
  );
  
  // Limite menor para análise AI
  app.post('/api/analyze',
    express.json({ limit: '100kb' }),
    requireApiKey,
    handleAnalyze
  );
  ```

- [ ] **Passo 2**: Testar limites
  ```bash
  # Testar com payload grande
  dd if=/dev/zero bs=1M count=2 | base64 > large_payload.txt
  curl -X POST http://localhost:8080/api/analyze \
    -H "Content-Type: application/json" \
    -d @large_payload.txt
  # Deve retornar 413 Payload Too Large
  ```

**Tempo Estimado**: 1 hora  
**Prioridade**: 🟠 ALTA

---

## 🟡 FASE 3: MÉDIO (Prazo: 2-4 semanas)

### Issue #9: Sanitizar Parsing de KML

- [ ] Implementar sanitização de XML antes do parsing
- [ ] Remover DOCTYPE e ENTITY declarations
- [ ] Adicionar validação de schema
- [ ] Testar com KML maliciosos

**Tempo Estimado**: 1 hora  
**Prioridade**: 🟡 MÉDIA

---

### Issue #10: Implementar Exponential Backoff

- [ ] Criar hook `useExponentialBackoff`
- [ ] Aplicar em `useDxfExport.ts`
- [ ] Aplicar em `BatchUpload.tsx`
- [ ] Testar progressão de delays

**Tempo Estimado**: 1 hora  
**Prioridade**: 🟡 MÉDIA

---

### Issue #11: Corrigir Memory Leak em BatchUpload

- [ ] Adicionar cleanup no useEffect
- [ ] Garantir clearInterval em todos os caminhos
- [ ] Testar montagem/desmontagem do componente

**Tempo Estimado**: 30 minutos  
**Prioridade**: 🟡 MÉDIA

---

### Issue #12: Reduzir Exposição de Logs

- [ ] Remover detalhes de infra GCP dos logs públicos
- [ ] Mover logs detalhados para logging estruturado
- [ ] Implementar níveis de log (debug, info, error)

**Tempo Estimado**: 2 horas  
**Prioridade**: 🟡 MÉDIA

---

### Issue #13: Migrar Cache para Cloud Storage

- [ ] Implementar CacheService com Cloud Storage
- [ ] Configurar bucket de cache
- [ ] Migrar de Map para Storage
- [ ] Testar recuperação de cache

**Tempo Estimado**: 3 horas  
**Prioridade**: 🟡 MÉDIA

---

### Issue #14: Adicionar CSP Headers

- [ ] Instalar helmet
  ```bash
  npm install helmet
  ```

- [ ] Configurar CSP
  ```typescript
  import helmet from 'helmet';
  
  app.use(helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openstreetmap.org"]
    }
  }));
  ```

**Tempo Estimado**: 1 hora  
**Prioridade**: 🟡 MÉDIA

---

## 📊 Tracking de Progresso

### Resumo

| Fase | Issues | Completados | % |
|------|--------|-------------|---|
| Fase 1 (Crítico) | 3 | 0 | 0% |
| Fase 2 (Alto) | 5 | 0 | 0% |
| Fase 3 (Médio) | 6 | 0 | 0% |
| **TOTAL** | **14** | **0** | **0%** |

### Marcos

- [ ] **Marco 1**: Todas as correções críticas (Score: 7.5/10)
- [ ] **Marco 2**: Todas as correções altas (Score: 8.5/10)
- [ ] **Marco 3**: Todas as correções médias (Score: 9.0/10)

---

## 🧪 Testes Finais

Após implementar cada fase, executar:

```bash
# Testes unitários
npm run test:backend
npm run test:frontend

# Testes E2E
npm run test:e2e

# Security audit
npm audit
npm audit --production

# Build
npm run build

# Docker build
docker build -t sisrua:test .

# Teste local
docker run -p 8080:8080 sisrua:test
```

---

## 📝 Notas

- Cada item deve ser implementado em um branch separado
- Criar PR para cada correção
- Executar testes antes de merge
- Deploy em staging antes de produção
- Atualizar documentação conforme necessário

**Boa sorte! 🚀**
