import crypto from 'crypto';

type CacheEntry = {
    filename: string;
    expiresAt: number;
};

type DxfCachePayload = {
    lat: number;
    lon: number;
    radius: number;
    mode: string;
    polygon: unknown;
    layers: unknown;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const cacheStore = new Map<string, CacheEntry>();

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

const getCachedFilename = (key: string): string | null => {
    const entry = cacheStore.get(key);
    if (!entry) {
        return null;
    }

    if (entry.expiresAt <= Date.now()) {
        cacheStore.delete(key);
        return null;
    }

    return entry.filename;
};

const setCachedFilename = (key: string, filename: string, ttlMs: number = DEFAULT_TTL_MS): void => {
    cacheStore.set(key, {
        filename,
        expiresAt: Date.now() + ttlMs
    });
};

const deleteCachedFilename = (key: string): void => {
    cacheStore.delete(key);
};

export {
    createCacheKey,
    getCachedFilename,
    setCachedFilename,
    deleteCachedFilename,
    DEFAULT_TTL_MS
};
