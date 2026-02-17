import {
  createCacheKey,
  getCachedFilename,
  setCachedFilename,
  deleteCachedFilename,
  DEFAULT_TTL_MS
} from '../services/cacheService';

describe('CacheService', () => {
  describe('createCacheKey', () => {
    it('should generate consistent hash for same payload', () => {
      const payload = {
        lat: -23.5505,
        lon: -46.6333,
        radius: 500,
        mode: 'circle',
        polygon: null,
        layers: {}
      };

      const key1 = createCacheKey(payload);
      const key2 = createCacheKey(payload);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 produces 64-character hex
    });

    it('should generate different hashes for different payloads', () => {
      const payload1 = {
        lat: -23.5505,
        lon: -46.6333,
        radius: 500,
        mode: 'circle',
        polygon: null,
        layers: {}
      };

      const payload2 = {
        lat: -23.5510,
        lon: -46.6333,
        radius: 500,
        mode: 'circle',
        polygon: null,
        layers: {}
      };

      const key1 = createCacheKey(payload1);
      const key2 = createCacheKey(payload2);

      expect(key1).not.toBe(key2);
    });

    it('should handle polygon arrays consistently', () => {
      const payload1 = {
        lat: -23.5505,
        lon: -46.6333,
        radius: 500,
        mode: 'polygon',
        polygon: [[1, 2], [3, 4]],
        layers: {}
      };

      const payload2 = {
        lat: -23.5505,
        lon: -46.6333,
        radius: 500,
        mode: 'polygon',
        polygon: [[1, 2], [3, 4]],
        layers: {}
      };

      const key1 = createCacheKey(payload1);
      const key2 = createCacheKey(payload2);

      expect(key1).toBe(key2);
    });

    it('should normalize null and undefined polygon values', () => {
      const payload1 = {
        lat: -23.5505,
        lon: -46.6333,
        radius: 500,
        mode: 'circle',
        polygon: null,
        layers: {}
      };

      const payload2 = {
        lat: -23.5505,
        lon: -46.6333,
        radius: 500,
        mode: 'circle',
        polygon: undefined,
        layers: {}
      };

      const key1 = createCacheKey(payload1);
      const key2 = createCacheKey(payload2);

      expect(key1).toBe(key2);
    });

    it('should handle layer objects consistently regardless of key order', () => {
      const payload1 = {
        lat: -23.5505,
        lon: -46.6333,
        radius: 500,
        mode: 'circle',
        polygon: null,
        layers: { buildings: true, roads: false }
      };

      const payload2 = {
        lat: -23.5505,
        lon: -46.6333,
        radius: 500,
        mode: 'circle',
        polygon: null,
        layers: { roads: false, buildings: true } // Different order
      };

      const key1 = createCacheKey(payload1);
      const key2 = createCacheKey(payload2);

      // Should be the same because keys are sorted internally
      expect(key1).toBe(key2);
    });
  });

  describe('setCachedFilename and getCachedFilename', () => {
    it('should store and retrieve cached filename', () => {
      const key = 'test-key-123';
      const filename = 'dxf_test_123.dxf';

      setCachedFilename(key, filename);
      const retrieved = getCachedFilename(key);

      expect(retrieved).toBe(filename);
    });

    it('should return null for non-existent key', () => {
      const retrieved = getCachedFilename('non-existent-key-' + Date.now());
      expect(retrieved).toBeNull();
    });

    it('should respect custom TTL', () => {
      jest.useFakeTimers();

      const key = 'test-key-ttl-' + Date.now();
      const filename = 'dxf_ttl.dxf';
      const customTTL = 1000; // 1 second

      setCachedFilename(key, filename, customTTL);

      // Should be available immediately
      expect(getCachedFilename(key)).toBe(filename);

      // Advance time by 500ms (within TTL)
      jest.advanceTimersByTime(500);
      expect(getCachedFilename(key)).toBe(filename);

      // Advance time past TTL
      jest.advanceTimersByTime(600);
      expect(getCachedFilename(key)).toBeNull();

      jest.useRealTimers();
    });

    it('should use default TTL when not specified', () => {
      jest.useFakeTimers();

      const key = 'test-key-default-ttl-' + Date.now();
      const filename = 'dxf_default.dxf';

      setCachedFilename(key, filename);

      // Should be available immediately
      expect(getCachedFilename(key)).toBe(filename);

      // Advance time by less than default TTL (24 hours)
      jest.advanceTimersByTime(DEFAULT_TTL_MS - 1000);
      expect(getCachedFilename(key)).toBe(filename);

      // Advance time past default TTL
      jest.advanceTimersByTime(2000);
      expect(getCachedFilename(key)).toBeNull();

      jest.useRealTimers();
    });
  });

  describe('deleteCachedFilename', () => {
    it('should delete cached entry', () => {
      const key = 'test-key-delete-' + Date.now();
      const filename = 'dxf_delete.dxf';

      setCachedFilename(key, filename);
      expect(getCachedFilename(key)).toBe(filename);

      deleteCachedFilename(key);
      expect(getCachedFilename(key)).toBeNull();
    });

    it('should not throw when deleting non-existent key', () => {
      expect(() => {
        deleteCachedFilename('non-existent-key-' + Date.now());
      }).not.toThrow();
    });
  });

  describe('Cache expiration behavior', () => {
    it('should automatically clean expired entries on retrieval', () => {
      jest.useFakeTimers();

      const key = 'test-key-expire-' + Date.now();
      const filename = 'dxf_expire.dxf';

      setCachedFilename(key, filename, 1000);

      // Cache hit within TTL
      expect(getCachedFilename(key)).toBe(filename);

      // Advance time past expiration
      jest.advanceTimersByTime(1500);

      // Should return null and clean up
      expect(getCachedFilename(key)).toBeNull();

      // Subsequent calls should also return null
      expect(getCachedFilename(key)).toBeNull();

      jest.useRealTimers();
    });

    it('should handle multiple cache entries with different TTLs', () => {
      jest.useFakeTimers();

      const key1 = 'test-key-multi-1-' + Date.now();
      const key2 = 'test-key-multi-2-' + Date.now();
      const filename1 = 'dxf_multi_1.dxf';
      const filename2 = 'dxf_multi_2.dxf';

      setCachedFilename(key1, filename1, 1000); // 1 second
      setCachedFilename(key2, filename2, 2000); // 2 seconds

      // Both should be available initially
      expect(getCachedFilename(key1)).toBe(filename1);
      expect(getCachedFilename(key2)).toBe(filename2);

      // Advance time past first TTL
      jest.advanceTimersByTime(1500);

      // First should be expired, second still valid
      expect(getCachedFilename(key1)).toBeNull();
      expect(getCachedFilename(key2)).toBe(filename2);

      // Advance time past second TTL
      jest.advanceTimersByTime(600);

      // Both should be expired
      expect(getCachedFilename(key1)).toBeNull();
      expect(getCachedFilename(key2)).toBeNull();

      jest.useRealTimers();
    });
  });
});
