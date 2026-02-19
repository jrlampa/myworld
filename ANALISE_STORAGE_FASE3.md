# 📊 Análise Comparativa de Armazenamento - Fase 3

**Data**: 19 de Fevereiro de 2026  
**Objetivo**: Escolher solução de armazenamento persistente para job status e cache

---

## 🎯 Contexto e Requisitos

### Dados Atuais (Em Memória)
- **Job Status**: Map<string, JobInfo> - ~100 jobs/dia, 1h TTL
- **Cache DXF**: Map<string, CacheEntry> - ~500 refs/dia, 24h TTL

### Requisitos da Fase 3
1. ✅ Armazenamento persistente (sobrevive a restarts)
2. ✅ Circuit breaker aos 95% da quota
3. ✅ Limpeza automática aos 80% do armazenamento
4. ✅ Monitoramento em tempo real (se aplicável)
5. ✅ Dentro do free tier

### Estimativa de Uso
```
Job Status:
- Volume: 100 jobs/dia
- Tamanho: ~200 bytes/job
- Operações: 100 creates + 300 updates/dia = 400 gravações
- Armazenamento: 600KB/mês (com 1h TTL)

Cache DXF (metadados):
- Volume: 500 refs/dia  
- Tamanho: ~300 bytes/ref
- Operações: 500 sets + 100 updates/dia = 600 gravações
- Armazenamento: 4.5MB/mês (com 24h TTL)

TOTAL ESTIMADO:
- Gravações: 1,000-1,500/dia
- Leituras: 5,000-10,000/dia
- Armazenamento: ~5MB/mês
- Exclusões: 50-100/dia (limpeza)
```

---

## 🔍 Opção 1: Google Firestore

### Quotas Gratuitas (Spark Plan)
```
✅ Armazenamento:        1 GiB          (5MB = 0.5% da quota)
✅ Leituras:             50,000/dia     (10k = 20% da quota)
✅ Gravações:            20,000/dia     (1.5k = 7.5% da quota)
✅ Exclusões:            20,000/dia     (100 = 0.5% da quota)
✅ Transferência saída:  10 GiB/mês     (desprezível)
```

### Análise Detalhada

**Adequação ao Caso de Uso**: ⭐⭐⭐⭐⭐ (5/5)
- ✅ **Projetado para metadata**: Firestore é NoSQL document database
- ✅ **Queries poderosos**: `orderBy('createdAt').limit(100)`
- ✅ **TTL automático**: Pode configurar expiração
- ✅ **Transações ACID**: Consistência garantida
- ✅ **Indexação automática**: Queries rápidos

**Monitoramento e Quotas**: ⭐⭐⭐⭐⭐ (5/5)
- ✅ **Cloud Monitoring**: Métricas nativas do GCP
- ✅ **Real-time listeners**: Para monitorar mudanças
- ✅ **Quota tracking**: Via Admin SDK
- ✅ **Alertas**: Cloud Monitoring pode disparar alertas

**Integração GCP**: ⭐⭐⭐⭐⭐ (5/5)
- ✅ **Nativo**: Parte do ecossistema GCP
- ✅ **Autenticação**: Usa mesmas credenciais do Cloud Run
- ✅ **Região**: Pode escolher southamerica-east1
- ✅ **Billing**: Unificado com Cloud Run

**Facilidade de Implementação**: ⭐⭐⭐⭐ (4/5)
- ✅ **SDK maduro**: @google-cloud/firestore
- ✅ **Documentação**: Excelente
- ✅ **TypeScript**: Suporte completo
- ⚠️ **Curva de aprendizado**: NoSQL (mas simples)

**Custos Futuros**: ⭐⭐⭐⭐ (4/5)
- ✅ **Free tier generoso**: 20k gravações/dia
- ✅ **Previsível**: $0.18/100k leituras, $0.18/100k gravações
- ⚠️ **Pode escalar rápido**: Se ultrapassar free tier

**Limitações**:
- ⚠️ Limite de gravações (20k/dia) pode ser apertado com escala
- ⚠️ Não é ideal para armazenar arquivos grandes (DXF)

**Score Total**: 23/25 (92%)

---

## 🔍 Opção 2: Google Cloud Storage

### Quotas Gratuitas (Always Free)
```
✅ Armazenamento:        5 GB/mês (Regional Storage)
⚠️ Operações Classe A:   5,000/mês    (PUT, POST, LIST)
✅ Operações Classe B:   50,000/mês   (GET, HEAD)
✅ Transferência:        1 GB/mês (Americas)
```

### Análise Detalhada

**Adequação ao Caso de Uso**: ⭐⭐ (2/5)
- ❌ **Não é database**: Não tem queries
- ❌ **Job status**: Teria que criar 1 arquivo por job
- ✅ **Arquivos DXF**: Perfeito para isso
- ❌ **Listagem cara**: 5,000 ops/mês é MUITO POUCO
- ❌ **Sem índices**: Teria que ler tudo

**Monitoramento e Quotas**: ⭐⭐⭐ (3/5)
- ✅ **Cloud Monitoring**: Métricas nativas
- ⚠️ **Quota tracking**: Possível mas menos granular
- ❌ **Real-time**: Não suporta

**Integração GCP**: ⭐⭐⭐⭐⭐ (5/5)
- ✅ **Nativo**: Parte do ecossistema GCP
- ✅ **Autenticação**: Integrada
- ✅ **CDN**: Cloud CDN pode cachear

**Facilidade de Implementação**: ⭐⭐ (2/5)
- ⚠️ **Para job status**: Muito trabalho
- ⚠️ **Listagem**: Teria que implementar index separado
- ✅ **Para arquivos**: Simples

**Custos Futuros**: ⭐⭐⭐⭐⭐ (5/5)
- ✅ **Muito barato**: $0.02/GB/mês
- ✅ **Operações**: $0.05/10k operações

**Limitações**:
- ❌ **5,000 operações Classe A/mês**: 166/dia - INSUFICIENTE
- ❌ Não é database, precisa de workarounds
- ❌ Listagem cara e lenta

**Score Total**: 17/25 (68%)

**Conclusão**: GCS é ótimo para arquivos DXF, mas péssimo para job status.

---

## 🔍 Opção 3: Supabase

### Quotas Gratuitas (Free Plan)
```
✅ Database:             500 MB (PostgreSQL)
✅ Storage:              1 GB
✅ Bandwidth:            5 GB/mês
✅ Realtime:             Unlimited connections (2 concurrent)
✅ API Requests:         50,000/mês (unlimited em planos pagos)
⚠️ Pausa após 1 semana inativo (Free tier)
```

### Análise Detalhada

**Adequação ao Caso de Uso**: ⭐⭐⭐⭐⭐ (5/5)
- ✅ **PostgreSQL completo**: SQL poderoso
- ✅ **Realtime subscriptions**: Monitoramento nativo
- ✅ **Storage integrado**: Para arquivos DXF
- ✅ **Row Level Security**: Segurança granular
- ✅ **JSON support**: Pode armazenar metadados complexos

**Monitoramento e Quotas**: ⭐⭐⭐⭐ (4/5)
- ✅ **Dashboard**: Monitoramento de uso
- ✅ **Realtime**: Para monitorar mudanças
- ⚠️ **Quota API**: Não muito clara documentação
- ⚠️ **Alertas**: Menos integrado que GCP

**Integração GCP**: ⭐⭐ (2/5)
- ❌ **Serviço externo**: Não é GCP
- ⚠️ **Credenciais**: Precisa de API keys separadas
- ⚠️ **Região**: Pode ter latência (não tem SA)
- ❌ **Billing separado**: Mais uma conta

**Facilidade de Implementação**: ⭐⭐⭐⭐⭐ (5/5)
- ✅ **SDK excelente**: @supabase/supabase-js
- ✅ **TypeScript**: Primeira classe
- ✅ **Documentação**: Muito boa
- ✅ **Exemplos**: Abundantes

**Custos Futuros**: ⭐⭐⭐ (3/5)
- ✅ **Pro plan razoável**: $25/mês
- ⚠️ **Banco principal**: Tudo em um lugar (risco)
- ⚠️ **Lock-in**: Menos portável que GCP

**Limitações**:
- ⚠️ Pausa após 1 semana de inatividade (Free tier)
- ⚠️ 50k API requests/mês pode ser justo
- ⚠️ Serviço externo adiciona latência e complexidade

**Score Total**: 19/25 (76%)

---

## 🎯 Decisão Final: **GOOGLE FIRESTORE**

### Justificativa

**1. Melhor Score Geral**: 92% vs 76% (Supabase) vs 68% (GCS)

**2. Adequação Perfeita ao Caso de Uso**:
```typescript
// Job Status - Firestore é perfeito
const job = {
  id: 'job-123',
  status: 'processing',
  progress: 50,
  createdAt: Timestamp.now()
};
await db.collection('jobs').doc('job-123').set(job);

// Query para limpeza
const oldJobs = await db.collection('jobs')
  .where('createdAt', '<', oneHourAgo)
  .get();
```

**3. Quotas Mais que Suficientes**:
```
Uso estimado vs Quotas:
- Gravações: 1,500/dia (7.5% de 20,000)  ✅
- Leituras:  10,000/dia (20% de 50,000)  ✅
- Storage:   5MB (0.5% de 1GB)            ✅
```

**4. Integração Nativa GCP**:
- ✅ Mesmas credenciais do Cloud Run
- ✅ Mesma região (southamerica-east1)
- ✅ Billing unificado
- ✅ Cloud Monitoring integrado

**5. Monitoramento em Tempo Real**:
```typescript
// Listener para monitorar quotas
db.collection('_usage').onSnapshot(snapshot => {
  const usage = snapshot.data();
  if (usage.writes > 0.95 * 20000) {
    // Circuit breaker!
  }
});
```

**6. Escalabilidade**:
- Cresce automaticamente com o projeto
- Sem limite de throughput (pago)
- Multi-região disponível

### Solução Híbrida (Opcional para Fase 4)
```
- Firestore: Job status e cache metadata ✅
- Cloud Storage: Arquivos DXF grandes (futuramente) 📅
- Local filesystem: Arquivos temporários (atual) ✅
```

---

## 📋 Arquitetura da Solução

### Estrutura Firestore

```
sisrua-production (database)
├── jobs/
│   └── {jobId}
│       ├── id: string
│       ├── status: 'queued' | 'processing' | 'completed' | 'failed'
│       ├── progress: number
│       ├── result?: { url, filename }
│       ├── error?: string
│       ├── createdAt: Timestamp
│       └── updatedAt: Timestamp
│
├── cache/
│   └── {cacheKey}
│       ├── key: string
│       ├── filename: string
│       ├── expiresAt: Timestamp
│       └── createdAt: Timestamp
│
└── quotaMonitor/
    └── daily
        ├── date: string (YYYY-MM-DD)
        ├── reads: number
        ├── writes: number
        ├── deletes: number
        ├── storageBytes: number
        └── lastUpdated: Timestamp
```

### Circuit Breaker Strategy

```typescript
class FirestoreCircuitBreaker {
  private quotaLimits = {
    reads: 50000,
    writes: 20000,
    deletes: 20000,
    storage: 1024 * 1024 * 1024 // 1GB
  };
  
  async checkQuota(operation: 'read' | 'write' | 'delete'): Promise<boolean> {
    const usage = await this.getCurrentUsage();
    const limit = this.quotaLimits[`${operation}s`];
    
    // 95% threshold
    if (usage[`${operation}s`] >= limit * 0.95) {
      logger.error(`Circuit breaker: ${operation} quota at ${usage}%`);
      return false; // Reject operation
    }
    
    return true; // Allow operation
  }
}
```

### Auto-Cleanup Strategy

```typescript
async cleanupOldData() {
  const usage = await this.getStorageUsage();
  const storageThreshold = this.quotaLimits.storage * 0.80; // 80%
  
  if (usage.storageBytes >= storageThreshold) {
    logger.warn('Storage at 80%, starting cleanup');
    
    // Delete oldest jobs first
    const oldJobs = await db.collection('jobs')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();
    
    // Delete oldest cache entries
    const oldCache = await db.collection('cache')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();
    
    // Batch delete
    const batch = db.batch();
    [...oldJobs.docs, ...oldCache.docs].forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}
```

---

## ✅ Vantagens da Solução Escolhida

1. ✅ **Nativa GCP**: Sem dependências externas
2. ✅ **Free tier generoso**: Difícil de ultrapassar
3. ✅ **Real-time**: Monitoramento nativo
4. ✅ **Queries poderosos**: Limpeza eficiente
5. ✅ **Escalável**: Cresce com projeto
6. ✅ **Maduro**: SDK estável e documentado
7. ✅ **Type-safe**: TypeScript de primeira
8. ✅ **Transações**: Consistência ACID

---

## 📊 Comparação Final

| Critério | Firestore | Cloud Storage | Supabase |
|----------|-----------|---------------|----------|
| Adequação | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Quotas | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Integração GCP | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Implementação | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| Custos | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **TOTAL** | **23/25** | **17/25** | **19/25** |

**Vencedor**: 🏆 **Google Firestore**

---

## 🚀 Próximos Passos

1. [ ] Implementar FirestoreService com circuit breaker
2. [ ] Implementar quota monitoring
3. [ ] Implementar auto-cleanup
4. [ ] Migrar jobStatusService
5. [ ] Migrar cacheService
6. [ ] Testes e validação
7. [ ] Documentação

---

**Data**: 19/02/2026  
**Decisão**: Google Firestore  
**Justificativa**: Melhor adequação técnica, integração GCP, quotas suficientes, real-time monitoring
