# Firestore Storage

This document covers Firestore integration for persistent job status and DXF cache storage in SIS RUA (Phase 3 implementation).

## Why Firestore?

Comparative analysis of storage options:

| Criteria | Firestore | Cloud Storage | Supabase |
|----------|-----------|---------------|----------|
| Metadata queries | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| GCP integration | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Free tier fit | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Real-time | ⭐⭐⭐⭐⭐ | ❌ | ⭐⭐⭐⭐ |
| **Score** | **23/25** | **17/25** | **19/25** |

**Winner: Google Firestore** — Native GCP service, ideal for metadata, generous free tier.

## Free Tier Limits vs Estimated Usage

```
Quotas:
- Reads:    50,000/day    →  ~10,000 used  (20%)
- Writes:   20,000/day    →  ~1,500 used   (7.5%)
- Deletes:  20,000/day    →  ~100 used     (0.5%)
- Storage:  1 GB          →  ~5 MB used    (0.5%)
```

## Data Structure

```
sisrua-production (database)
├── jobs/
│   └── {jobId}
│       ├── id: string
│       ├── status: 'queued' | 'processing' | 'completed' | 'failed'
│       ├── progress: number (0-100)
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

## Features Implemented

- ✅ **Circuit Breaker** — Blocks operations at 95% of quota
- ✅ **Auto-Cleanup** — Deletes old data at 80% storage usage
- ✅ **Real-Time Monitoring** — Quota tracking every 5 minutes
- ✅ **Graceful Fallback** — Falls back to in-memory storage if Firestore is unavailable
- ✅ **Status Endpoint** — `/api/firestore/status` for monitoring

## Configuration

### Development

```bash
# Download service account key from GCP Console
# IAM & Admin > Service Accounts > Create Key (JSON)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# Enable Firestore in .env
USE_FIRESTORE=true
GCP_PROJECT=sisrua-producao
```

### Production (Cloud Run)

Firestore is automatically enabled in production using Application Default Credentials:

```bash
NODE_ENV=production  # Firestore ON automatically
GCP_PROJECT=sisrua-producao
```

No key file needed — Cloud Run uses the compute service account.

## Monitoring

### Status Endpoint

```bash
curl http://localhost:8080/api/firestore/status
```

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
    "reads": { "used": 1500, "limit": 50000, "percentage": 3 },
    "writes": { "used": 200, "limit": 20000, "percentage": 1 }
  }
}
```

## Circuit Breaker

Protects against quota exhaustion:

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
    
    // Reject at 95% threshold
    if (usage[`${operation}s`] >= limit * 0.95) {
      logger.error(`Circuit breaker: ${operation} quota at 95%`);
      return false;
    }
    return true;
  }
}
```

## Auto-Cleanup Strategy

When storage reaches 80%, automatically delete oldest data:

```typescript
async cleanupOldData() {
  const storageThreshold = 1024 * 1024 * 1024 * 0.80; // 80% of 1GB
  
  if (currentStorageBytes >= storageThreshold) {
    const batch = db.batch();
    
    // Delete oldest jobs
    const oldJobs = await db.collection('jobs')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();
    
    // Delete oldest cache entries
    const oldCache = await db.collection('cache')
      .orderBy('createdAt', 'asc')
      .limit(100)
      .get();
    
    [...oldJobs.docs, ...oldCache.docs].forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}
```

## Future: Hybrid Storage

For Phase 4, a hybrid approach is recommended:

- **Firestore**: Job status and DXF metadata
- **Cloud Storage**: Large DXF files (>5MB)
- **Local filesystem**: Temporary files during generation
