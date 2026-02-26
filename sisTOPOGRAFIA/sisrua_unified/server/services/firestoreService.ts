/**
 * Firestore Service with Circuit Breaker and Quota Monitoring
 * 
 * Features:
 * - Circuit breaker at 95% of quota
 * - Auto-cleanup at 80% of storage
 * - Real-time quota monitoring
 * - Safe shutdown handling
 */

import { Firestore, Timestamp, FieldValue } from '@google-cloud/firestore';
import { logger } from '../utils/logger.js';

// Firestore quotas (free tier)
const QUOTAS = {
    READS_PER_DAY: 50000,
    WRITES_PER_DAY: 20000,
    DELETES_PER_DAY: 20000,
    STORAGE_BYTES: 1024 * 1024 * 1024, // 1 GiB
};

// Thresholds
const CIRCUIT_BREAKER_THRESHOLD = 0.95; // 95%
const CLEANUP_THRESHOLD = 0.80; // 80%

interface QuotaUsage {
    date: string; // YYYY-MM-DD
    reads: number;
    writes: number;
    deletes: number;
    storageBytes: number;
    lastUpdated: Timestamp;
}

interface CircuitBreakerStatus {
    isOpen: boolean;
    operation?: string;
    usage: number;
    limit: number;
}

class FirestoreService {
    private db: Firestore;
    private quotaMonitorInterval: NodeJS.Timeout | null = null;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private circuitBreakerStatus: CircuitBreakerStatus = {
        isOpen: false,
        usage: 0,
        limit: 0
    };

    constructor() {
        // Initialize Firestore
        this.db = new Firestore({
            projectId: process.env.GCP_PROJECT,
            // Uses Application Default Credentials (ADC) in Cloud Run
            // For local dev, set GOOGLE_APPLICATION_CREDENTIALS
        });

        logger.info('Firestore initialized', {
            project: process.env.GCP_PROJECT,
            quotas: QUOTAS
        });
    }

    /**
     * Start quota monitoring and auto-cleanup
     */
    async start(): Promise<void> {
        logger.info('Starting Firestore quota monitoring');

        // Initialize quota document for today
        await this.initializeDailyQuota();

        // Monitor quotas every 5 minutes
        this.quotaMonitorInterval = setInterval(async () => {
            try {
                await this.monitorQuotas();
            } catch (error) {
                logger.error('Quota monitoring failed', { error });
            }
        }, 5 * 60 * 1000); // 5 minutes

        // Cleanup check every 30 minutes
        this.cleanupInterval = setInterval(async () => {
            try {
                await this.checkAndCleanup();
            } catch (error) {
                logger.error('Auto-cleanup failed', { error });
            }
        }, 30 * 60 * 1000); // 30 minutes

        // Initial check
        await this.monitorQuotas();
        await this.checkAndCleanup();
    }

    /**
     * Stop monitoring (graceful shutdown)
     */
    stop(): void {
        if (this.quotaMonitorInterval) {
            clearInterval(this.quotaMonitorInterval);
            this.quotaMonitorInterval = null;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        logger.info('Firestore monitoring stopped');
    }

    /**
     * Initialize quota document for current day
     */
    private async initializeDailyQuota(): Promise<void> {
        const today = new Date().toISOString().split('T')[0];
        const quotaRef = this.db.collection('quotaMonitor').doc(today);

        try {
            const doc = await quotaRef.get();
            if (!doc.exists) {
                await quotaRef.set({
                    date: today,
                    reads: 0,
                    writes: 0,
                    deletes: 0,
                    storageBytes: 0,
                    lastUpdated: Timestamp.now()
                });
                logger.info('Initialized quota document', { date: today });
            }
        } catch (error) {
            logger.error('Failed to initialize quota document', { error });
        }
    }

    /**
     * Get current quota usage
     */
    async getCurrentUsage(): Promise<QuotaUsage> {
        const today = new Date().toISOString().split('T')[0];
        const quotaRef = this.db.collection('quotaMonitor').doc(today);

        try {
            const doc = await quotaRef.get();
            if (!doc.exists) {
                await this.initializeDailyQuota();
                return {
                    date: today,
                    reads: 0,
                    writes: 0,
                    deletes: 0,
                    storageBytes: 0,
                    lastUpdated: Timestamp.now()
                };
            }

            return doc.data() as QuotaUsage;
        } catch (error) {
            logger.error('Failed to get quota usage', { error });
            throw error;
        }
    }

    /**
     * Increment quota counter
     */
    private async incrementQuota(operation: 'reads' | 'writes' | 'deletes', count: number = 1): Promise<void> {
        const today = new Date().toISOString().split('T')[0];
        const quotaRef = this.db.collection('quotaMonitor').doc(today);

        try {
            await quotaRef.update({
                [operation]: FieldValue.increment(count),
                lastUpdated: Timestamp.now()
            });
        } catch (error) {
            logger.error('Failed to increment quota', { operation, error });
            // Don't throw - quota tracking failure shouldn't break the app
        }
    }

    /**
     * Check if circuit breaker should open
     */
    async checkCircuitBreaker(operation: 'reads' | 'writes' | 'deletes'): Promise<boolean> {
        const usage = await this.getCurrentUsage();
        const currentUsage = usage[operation];
        const limit = QUOTAS[`${operation.toUpperCase()}_PER_DAY` as keyof typeof QUOTAS] as number;

        const percentage = currentUsage / limit;

        if (percentage >= CIRCUIT_BREAKER_THRESHOLD) {
            this.circuitBreakerStatus = {
                isOpen: true,
                operation,
                usage: currentUsage,
                limit
            };

            logger.error('Circuit breaker OPEN', {
                operation,
                usage: currentUsage,
                limit,
                percentage: `${(percentage * 100).toFixed(2)}%`
            });

            return false; // Reject operation
        }

        return true; // Allow operation
    }

    /**
     * Monitor quotas and trigger circuit breaker if needed
     */
    private async monitorQuotas(): Promise<void> {
        const usage = await this.getCurrentUsage();

        const checks = {
            reads: usage.reads / QUOTAS.READS_PER_DAY,
            writes: usage.writes / QUOTAS.WRITES_PER_DAY,
            deletes: usage.deletes / QUOTAS.DELETES_PER_DAY,
            storage: usage.storageBytes / QUOTAS.STORAGE_BYTES
        };

        // Log current usage
        logger.info('Quota usage', {
            reads: `${usage.reads}/${QUOTAS.READS_PER_DAY} (${(checks.reads * 100).toFixed(2)}%)`,
            writes: `${usage.writes}/${QUOTAS.WRITES_PER_DAY} (${(checks.writes * 100).toFixed(2)}%)`,
            deletes: `${usage.deletes}/${QUOTAS.DELETES_PER_DAY} (${(checks.deletes * 100).toFixed(2)}%)`,
            storage: `${(usage.storageBytes / 1024 / 1024).toFixed(2)}MB/${(QUOTAS.STORAGE_BYTES / 1024 / 1024).toFixed(2)}MB (${(checks.storage * 100).toFixed(2)}%)`
        });

        // Check for warnings (>80%)
        Object.entries(checks).forEach(([operation, percentage]) => {
            if (percentage >= 0.80 && percentage < CIRCUIT_BREAKER_THRESHOLD) {
                logger.warn(`Quota warning: ${operation} at ${(percentage * 100).toFixed(2)}%`);
            }
        });

        // Update circuit breaker status
        const criticalOperation = Object.entries(checks).find(([_, pct]) => pct >= CIRCUIT_BREAKER_THRESHOLD);
        if (criticalOperation) {
            this.circuitBreakerStatus.isOpen = true;
            this.circuitBreakerStatus.operation = criticalOperation[0];
        } else {
            this.circuitBreakerStatus.isOpen = false;
        }
    }

    /**
     * Check storage and cleanup if needed
     */
    private async checkAndCleanup(): Promise<void> {
        const usage = await this.getCurrentUsage();
        const storagePercentage = usage.storageBytes / QUOTAS.STORAGE_BYTES;

        logger.info('Storage check', {
            bytes: usage.storageBytes,
            percentage: `${(storagePercentage * 100).toFixed(2)}%`,
            threshold: `${(CLEANUP_THRESHOLD * 100)}%`
        });

        if (storagePercentage >= CLEANUP_THRESHOLD) {
            logger.warn('Storage threshold reached, starting cleanup', {
                percentage: `${(storagePercentage * 100).toFixed(2)}%`
            });

            await this.cleanupOldData();
        }
    }

    /**
     * Cleanup old data (oldest first)
     */
    private async cleanupOldData(): Promise<void> {
        logger.info('Starting auto-cleanup of old data');

        const batch = this.db.batch();
        let deleteCount = 0;

        try {
            // Cleanup old jobs (older than 1 hour)
            const oneHourAgo = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
            const oldJobs = await this.db.collection('jobs')
                .where('createdAt', '<', oneHourAgo)
                .orderBy('createdAt', 'asc')
                .limit(100)
                .get();

            oldJobs.docs.forEach(doc => {
                batch.delete(doc.ref);
                deleteCount++;
            });

            logger.info('Old jobs marked for deletion', { count: oldJobs.size });

            // Cleanup expired cache entries
            const now = Timestamp.now();
            const expiredCache = await this.db.collection('cache')
                .where('expiresAt', '<', now)
                .orderBy('expiresAt', 'asc')
                .limit(100)
                .get();

            expiredCache.docs.forEach(doc => {
                batch.delete(doc.ref);
                deleteCount++;
            });

            logger.info('Expired cache marked for deletion', { count: expiredCache.size });

            // Commit batch delete
            if (deleteCount > 0) {
                await batch.commit();
                logger.info('Auto-cleanup completed', { deletedCount: deleteCount });

                // Increment delete quota
                await this.incrementQuota('deletes', deleteCount);
            } else {
                logger.info('No data to cleanup');
            }
        } catch (error) {
            logger.error('Cleanup failed', { error });
        }
    }

    /**
     * Get Firestore instance
     */
    getDb(): Firestore {
        return this.db;
    }

    /**
     * Get circuit breaker status
     */
    getCircuitBreakerStatus(): CircuitBreakerStatus {
        return { ...this.circuitBreakerStatus };
    }

    /**
     * Safe read with circuit breaker and quota tracking
     */
    async safeRead<T>(collection: string, docId: string): Promise<T | null> {
        // Check circuit breaker
        const allowed = await this.checkCircuitBreaker('reads');
        if (!allowed) {
            throw new Error('Circuit breaker: Read quota exceeded (95%)');
        }

        try {
            const doc = await this.db.collection(collection).doc(docId).get();
            await this.incrementQuota('reads');

            if (!doc.exists) {
                return null;
            }

            return doc.data() as T;
        } catch (error) {
            logger.error('Safe read failed', { collection, docId, error });
            throw error;
        }
    }

    /**
     * Safe write with circuit breaker and quota tracking
     */
    async safeWrite<T extends Record<string, any>>(collection: string, docId: string, data: T): Promise<void> {
        // Check circuit breaker
        const allowed = await this.checkCircuitBreaker('writes');
        if (!allowed) {
            throw new Error('Circuit breaker: Write quota exceeded (95%)');
        }

        try {
            await this.db.collection(collection).doc(docId).set(data);
            await this.incrementQuota('writes');
        } catch (error) {
            logger.error('Safe write failed', { collection, docId, error });
            throw error;
        }
    }

    /**
     * Safe delete with circuit breaker and quota tracking
     */
    async safeDelete(collection: string, docId: string): Promise<void> {
        // Check circuit breaker
        const allowed = await this.checkCircuitBreaker('deletes');
        if (!allowed) {
            throw new Error('Circuit breaker: Delete quota exceeded (95%)');
        }

        try {
            await this.db.collection(collection).doc(docId).delete();
            await this.incrementQuota('deletes');
        } catch (error) {
            logger.error('Safe delete failed', { collection, docId, error });
            throw error;
        }
    }
}

// Singleton instance
let firestoreService: FirestoreService | null = null;

export function getFirestoreService(): FirestoreService {
    if (!firestoreService) {
        firestoreService = new FirestoreService();
    }
    return firestoreService;
}

export async function startFirestoreMonitoring(): Promise<void> {
    const service = getFirestoreService();
    await service.start();
}

export function stopFirestoreMonitoring(): void {
    if (firestoreService) {
        firestoreService.stop();
    }
}

export { FirestoreService, QUOTAS, CIRCUIT_BREAKER_THRESHOLD, CLEANUP_THRESHOLD };
export type { QuotaUsage, CircuitBreakerStatus };
