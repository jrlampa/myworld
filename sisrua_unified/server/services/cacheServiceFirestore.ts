/**
 * Cache Service - Firestore Implementation
 * 
 * Replaces in-memory Map with persistent Firestore storage
 * Features:
 * - Persistent cache across restarts
 * - Circuit breaker protection
 * - Automatic cleanup of expired entries
 * - Quota monitoring
 */

import crypto from 'crypto';
import { Timestamp } from '@google-cloud/firestore';
import { getFirestoreService } from './firestoreService.js';
import { logger } from '../utils/logger.js';

type CacheEntry = {
    key: string;
    filename: string;
    expiresAt: Timestamp | Date;
    createdAt: Timestamp | Date;
};

type DxfCachePayload = {
    lat: number;
    lon: number;
    radius: number;
    mode: string;
    polygon: unknown;
    layers: unknown;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Use Firestore or fallback to memory
const USE_FIRESTORE = process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true';

// In-memory fallback for development
const cacheStore = new Map<string, CacheEntry>();

/**
 * Stable serialization for cache key generation
 */
const stableSerialize = (value: unknown): string => {
    if (value === null || value === undefined) {
        return 'null';
    }

    if (typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
    }

    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
        a.localeCompare(b)
    );
    const serializedEntries = entries.map(
        ([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`
    );

    return `{${serializedEntries.join(',')}}`;
};

/**
 * Create a cache key from payload
 */
const createCacheKey = (payload: DxfCachePayload): string => {
    const normalizedPayload: DxfCachePayload = {
        lat: payload.lat,
        lon: payload.lon,
        radius: payload.radius,
        mode: payload.mode,
        polygon: payload.polygon ?? null,
        layers: payload.layers ?? {}
    };

    const serializedPayload = stableSerialize(normalizedPayload);
    return crypto.createHash('sha256').update(serializedPayload).digest('hex');
};

/**
 * Get cached filename by key
 */
const getCachedFilename = async (key: string): Promise<string | null> => {
    if (USE_FIRESTORE) {
        try {
            const firestoreService = getFirestoreService();
            const entry = await firestoreService.safeRead<CacheEntry>('cache', key);

            if (!entry) {
                return null;
            }

            // Check if expired
            const expiresAt = entry.expiresAt instanceof Timestamp 
                ? entry.expiresAt.toMillis() 
                : entry.expiresAt.getTime();

            if (expiresAt <= Date.now()) {
                // Delete expired entry
                try {
                    await firestoreService.safeDelete('cache', key);
                } catch (error) {
                    logger.warn('Failed to delete expired cache entry', { key, error });
                }
                return null;
            }

            return entry.filename;
        } catch (error: any) {
            if (error.message.includes('Circuit breaker')) {
                logger.warn('Cache read blocked by circuit breaker, checking memory', { key });
                // Fallback to memory
                const entry = cacheStore.get(key);
                if (!entry) {
                    return null;
                }
                const expiresAt = entry.expiresAt instanceof Date ? entry.expiresAt.getTime() : entry.expiresAt.toMillis();
                if (expiresAt <= Date.now()) {
                    cacheStore.delete(key);
                    return null;
                }
                return entry.filename;
            }
            throw error;
        }
    } else {
        // Memory mode
        const entry = cacheStore.get(key);
        if (!entry) {
            return null;
        }

        const expiresAt = entry.expiresAt instanceof Date ? entry.expiresAt.getTime() : entry.expiresAt.toMillis();
        if (expiresAt <= Date.now()) {
            cacheStore.delete(key);
            return null;
        }

        return entry.filename;
    }
};

/**
 * Set cached filename
 */
const setCachedFilename = async (key: string, filename: string, ttlMs: number = DEFAULT_TTL_MS): Promise<void> => {
    const entry: CacheEntry = {
        key,
        filename,
        expiresAt: Timestamp.fromMillis(Date.now() + ttlMs),
        createdAt: Timestamp.now()
    };

    if (USE_FIRESTORE) {
        try {
            const firestoreService = getFirestoreService();
            await firestoreService.safeWrite('cache', key, entry);
            logger.info('Cache entry set in Firestore', { key, filename, ttlMs });
        } catch (error: any) {
            if (error.message.includes('Circuit breaker')) {
                logger.warn('Cache write blocked by circuit breaker, using memory', { key });
                // Fallback to memory
                cacheStore.set(key, {
                    ...entry,
                    expiresAt: new Date(Date.now() + ttlMs),
                    createdAt: new Date()
                });
            } else {
                throw error;
            }
        }
    } else {
        // Memory mode
        cacheStore.set(key, {
            ...entry,
            expiresAt: new Date(Date.now() + ttlMs),
            createdAt: new Date()
        });
        logger.info('Cache entry set in memory', { key, filename, ttlMs });
    }
};

/**
 * Delete cached filename
 */
const deleteCachedFilename = async (key: string): Promise<void> => {
    if (USE_FIRESTORE) {
        try {
            const firestoreService = getFirestoreService();
            await firestoreService.safeDelete('cache', key);
            logger.info('Cache entry deleted from Firestore', { key });
        } catch (error: any) {
            if (error.message.includes('Circuit breaker')) {
                logger.warn('Cache delete blocked by circuit breaker, deleting from memory', { key });
                cacheStore.delete(key);
            } else {
                throw error;
            }
        }
    } else {
        cacheStore.delete(key);
        logger.info('Cache entry deleted from memory', { key });
    }
};

/**
 * Cleanup expired cache entries (called by Firestore auto-cleanup)
 */
export function cleanupExpiredCache(): void {
    if (!USE_FIRESTORE) {
        const now = Date.now();
        for (const [key, entry] of cacheStore.entries()) {
            const expiresAt = entry.expiresAt instanceof Date ? entry.expiresAt.getTime() : entry.expiresAt.toMillis();
            if (expiresAt <= now) {
                cacheStore.delete(key);
                logger.info('Cleaned up expired cache entry', { key });
            }
        }
    }
    // Firestore mode: cleanup handled by firestoreService
}

// Start periodic cleanup for memory mode
if (!USE_FIRESTORE) {
    setInterval(cleanupExpiredCache, 60 * 60 * 1000); // Every hour
}

export {
    createCacheKey,
    getCachedFilename,
    setCachedFilename,
    deleteCachedFilename,
    DEFAULT_TTL_MS
};
