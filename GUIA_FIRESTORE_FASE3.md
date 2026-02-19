# 🔥 Guia de Uso do Firestore - Fase 3

**Data**: 19 de Fevereiro de 2026  
**Implementação**: Armazenamento persistente com circuit breaker e auto-cleanup

---

## 📋 Visão Geral

O sistema agora usa **Google Firestore** para armazenar:
- **Job Status**: Estado de jobs async de geração DXF
- **Cache de DXF**: Metadados de arquivos DXF cacheados

### Features Implementadas

✅ **Circuit Breaker** - Bloqueia operações aos 95% da quota  
✅ **Auto-Cleanup** - Apaga dados antigos aos 80% do armazenamento  
✅ **Monitoramento em Tempo Real** - Tracking de quotas a cada 5 minutos  
✅ **Fallback Graceful** - Degrada para memória se necessário  
✅ **Endpoint de Status** - Dashboard de quotas e circuit breaker  

---

## 🚀 Como Usar

### Desenvolvimento Local

1. **Configurar credenciais GCP**:
```bash
# Baixar service account key do GCP Console
# IAM & Admin > Service Accounts > Create Key (JSON)

export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

2. **Habilitar Firestore** em `.env`:
```bash
USE_FIRESTORE=true
GCP_PROJECT=sisrua-producao
```

3. **Iniciar servidor**:
```bash
npm run server
```

4. **Verificar status**:
```bash
curl http://localhost:8080/api/firestore/status
```

### Produção (Cloud Run)

Em produção, Firestore é **automaticamente habilitado**:
```bash
NODE_ENV=production  # Firestore ON
GCP_PROJECT=sisrua-producao
```

Cloud Run usa **Application Default Credentials** (não precisa de key file).

---

## 📊 Monitoramento de Quotas

### Endpoint de Status

**GET `/api/firestore/status`**

Response:
```json
{
  "enabled": true,
  "mode": "firestore",
  "circuitBreaker": {
    "status": "CLOSED",
    "operation": "none",
    "message": "All operations allowed"
  },
  "quotas": {
    "date": "2026-02-19",
    "reads": {
      "current": 1234,
      "limit": 50000,
      "percentage": "2.47%",
      "available": 48766
    },
    "writes": {
      "current": 456,
      "limit": 20000,
      "percentage": "2.28%",
      "available": 19544
    },
    "deletes": {
      "current": 12,
      "limit": 20000,
      "percentage": "0.06%",
      "available": 19988
    },
    "storage": {
      "current": "2.34 MB",
      "limit": "1024 MB",
      "percentage": "0.23%",
      "bytes": 2453094
    }
  },
  "lastUpdated": "2026-02-19T01:30:00.000Z"
}
```

### Interpretação

| Status | Significado | Ação |
|--------|-------------|------|
| < 80% | ✅ Normal | Nenhuma |
| 80-95% | ⚠️ Atenção | Monitorar |
| ≥ 95% | 🔴 Circuit Breaker | Bloqueia operações |

---

## 🛡️ Circuit Breaker

### Como Funciona

O circuit breaker **bloqueia operações** quando a quota atinge **95%**:

```typescript
// Exemplo: Tentativa de escrever job
try {
  await firestoreService.safeWrite('jobs', id, data);
  // ✅ OK se quota < 95%
} catch (error) {
  if (error.message.includes('Circuit breaker')) {
    // ⚠️ Quota atingida! Usa memória como fallback
    jobs.set(id, data);
  }
}
```

### Estados do Circuit Breaker

1. **CLOSED** (Normal)
   - Quota < 95%
   - Todas operações permitidas
   - Status: `"status": "CLOSED"`

2. **OPEN** (Bloqueado)
   - Quota ≥ 95%
   - Operações bloqueadas
   - Fallback para memória
   - Status: `"status": "OPEN"`

### Quando o Circuit Breaker Abre?

```
Reads:   45,001/50,000   = 95.01% ❌ OPEN
Writes:  19,001/20,000   = 95.01% ❌ OPEN
Deletes: 19,001/20,000   = 95.01% ❌ OPEN
Storage: 972MB/1024MB    = 95.01% ❌ OPEN
```

### Como Resolver?

O circuit breaker **reseta automaticamente** às 00:00 UTC (novo dia):
- Quotas diárias são zeradas
- Circuit breaker volta para CLOSED
- Operações voltam ao normal

**Alternativa**: Se estorou a quota, pode:
1. Aguardar até meia-noite UTC
2. Aplicação continua funcionando (usa memória)
3. Dados em memória são perdidos em restart

---

## 🧹 Auto-Cleanup

### Quando Acontece?

Auto-cleanup é **ativado aos 80% do armazenamento**:

```
Storage: 819MB/1024MB = 80% 🧹 CLEANUP TRIGGERED
```

### O Que É Apagado?

**Em ordem de prioridade** (mais antigo primeiro):

1. **Jobs expirados** (criados há mais de 1 hora)
```typescript
const oneHourAgo = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
const oldJobs = await db.collection('jobs')
  .where('createdAt', '<', oneHourAgo)
  .orderBy('createdAt', 'asc')
  .limit(100)
  .get();
```

2. **Cache expirado** (após 24 horas)
```typescript
const now = Timestamp.now();
const expiredCache = await db.collection('cache')
  .where('expiresAt', '<', now)
  .orderBy('expiresAt', 'asc')
  .limit(100)
  .get();
```

### Frequência

- **Check**: A cada 30 minutos
- **Ação**: Só executa se storage ≥ 80%
- **Batch**: Apaga até 200 documentos por vez

### Logs

```
INFO: Storage check: 819MB/1024MB (80.02%)
WARN: Storage threshold reached, starting cleanup
INFO: Old jobs marked for deletion: 45
INFO: Expired cache marked for deletion: 78
INFO: Auto-cleanup completed: deletedCount=123
```

---

## 🗂️ Estrutura do Firestore

### Collections

```
sisrua-production (database)
│
├── jobs/                     # Job status
│   └── {jobId}
│       ├── id: string
│       ├── status: 'queued' | 'processing' | 'completed' | 'failed'
│       ├── progress: number
│       ├── result?: { url, filename }
│       ├── error?: string
│       ├── createdAt: Timestamp
│       └── updatedAt: Timestamp
│
├── cache/                    # Cache de DXF
│   └── {cacheKey}
│       ├── key: string (SHA-256)
│       ├── filename: string
│       ├── expiresAt: Timestamp (24h)
│       └── createdAt: Timestamp
│
└── quotaMonitor/             # Tracking de quotas
    └── {YYYY-MM-DD}
        ├── date: string
        ├── reads: number
        ├── writes: number
        ├── deletes: number
        ├── storageBytes: number
        └── lastUpdated: Timestamp
```

### Índices (Criados Automaticamente)

Firestore cria índices automaticamente para:
- `jobs.createdAt` (cleanup)
- `cache.expiresAt` (cleanup)
- `quotaMonitor.date` (lookup diário)

---

## 📈 Quotas do Free Tier

### Limites Diários

| Operação | Limite Diário | Uso Estimado | Margem |
|----------|---------------|--------------|--------|
| **Leituras** | 50,000 | ~10,000 (20%) | ✅ 5x |
| **Gravações** | 20,000 | ~1,500 (7.5%) | ✅ 13x |
| **Exclusões** | 20,000 | ~100 (0.5%) | ✅ 200x |

### Armazenamento

| Item | Limite | Uso Estimado | Margem |
|------|--------|--------------|--------|
| **Storage** | 1 GiB | ~5 MB (0.5%) | ✅ 200x |
| **Bandwidth** | 10 GiB/mês | < 100 MB | ✅ 100x |

### Estimativas de Uso

**Cenário Real** (100 jobs/dia, 500 cache entries/dia):
```
Gravações/dia:
- Jobs: 100 creates + 300 updates = 400
- Cache: 500 sets + 100 updates = 600
- Quota monitor: 288 updates (5min) = 288
- TOTAL: ~1,300 gravações/dia (6.5% da quota)

Leituras/dia:
- Job lookups: 1,000
- Cache lookups: 5,000
- Health checks: 500
- TOTAL: ~6,500 leituras/dia (13% da quota)

Storage:
- Jobs: 100 × 200 bytes × 1h TTL = 20KB
- Cache: 500 × 300 bytes × 24h = 150KB/dia
- TOTAL: ~5MB com 30 dias de dados
```

**Margem de Segurança**: **~15x** nas gravações (operação mais restritiva)

---

## 🔧 Troubleshooting

### Circuit Breaker Abriu

**Sintoma**: `error: "Circuit breaker: Write quota exceeded (95%)"`

**Causa**: Quota diária de gravações/leituras/deletes atingiu 95%

**Solução Imediata**:
1. Aplicação continua funcionando (usa memória)
2. Aguardar meia-noite UTC (reset de quotas)
3. Verificar causa do alto uso

**Solução Long-term**:
```bash
# Verificar logs para identificar padrão de uso
gcloud logging read "resource.type=cloud_run_revision" --limit 100

# Considerar upgrade para plano pago se necessário
```

### Storage Cheio (80%)

**Sintoma**: `WARN: Storage threshold reached, starting cleanup`

**Causa**: Armazenamento atingiu 80% de 1GB

**Solução Automática**: Auto-cleanup apaga dados antigos

**Se Persistir**:
1. Verificar se jobs/cache estão sendo criados excessivamente
2. Reduzir TTL de cache (de 24h para 12h)
3. Reduzir TTL de jobs (de 1h para 30min)

### Firestore Não Conecta

**Sintoma**: `error: "Failed to start Firestore monitoring"`

**Causa**: Credenciais GCP incorretas

**Solução**:
```bash
# Local development
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"

# Cloud Run (automático)
# Verificar que service account tem role:
# - Cloud Datastore User
# ou
# - Firebase Admin SDK Administrator
```

### Dados Não Persistem

**Sintoma**: Dados são perdidos em restart

**Causa**: Firestore não está habilitado

**Solução**:
```bash
# Verificar variável de ambiente
USE_FIRESTORE=true  # development
NODE_ENV=production # production

# Verificar logs
grep "Firestore" logs.txt
# Deve aparecer: "Firestore monitoring started"
```

---

## 🎯 Melhores Práticas

### 1. Monitorar Regularmente
```bash
# Verificar status a cada hora
watch -n 3600 'curl -s localhost:8080/api/firestore/status | jq .quotas'
```

### 2. Alertas Proativos
```bash
# Cloud Monitoring alert quando quota > 80%
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Firestore Quota Warning" \
  --condition-display-name="Quota > 80%" \
  --condition-threshold-value=0.80
```

### 3. Backup (Opcional)
```bash
# Backup diário do Firestore
gcloud firestore export gs://sisrua-backups/$(date +%Y%m%d)
```

### 4. Otimizar Leituras
```typescript
// ❌ Evitar: Ler job múltiplas vezes
const job1 = await getJob(id);
const job2 = await getJob(id); // Duplicado!

// ✅ Melhor: Cache local temporário
const job = await getJob(id);
// Usar `job` múltiplas vezes
```

---

## 📚 Recursos Adicionais

### Documentação
- [Firestore Quotas](https://firebase.google.com/docs/firestore/quotas)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)

### Código
- `server/services/firestoreService.ts` - Serviço principal
- `server/services/jobStatusServiceFirestore.ts` - Jobs
- `server/services/cacheServiceFirestore.ts` - Cache

### Monitoramento
- Cloud Console: https://console.cloud.google.com/firestore
- Metrics: https://console.cloud.google.com/monitoring

---

## ✅ Checklist de Implementação

### Desenvolvimento
- [ ] Criar service account no GCP Console
- [ ] Baixar JSON key
- [ ] Configurar `GOOGLE_APPLICATION_CREDENTIALS`
- [ ] Adicionar `USE_FIRESTORE=true` em `.env`
- [ ] Iniciar servidor
- [ ] Verificar `/api/firestore/status`
- [ ] Testar criação de job
- [ ] Verificar quota usage

### Produção
- [ ] Configurar Firestore no projeto GCP
- [ ] Garantir service account tem permissões
- [ ] Deploy para Cloud Run
- [ ] Verificar logs de inicialização
- [ ] Monitorar quotas por 24h
- [ ] Configurar alertas no Cloud Monitoring

---

**Data**: 19/02/2026  
**Versão**: 1.0  
**Status**: ✅ Implementado e Documentado
