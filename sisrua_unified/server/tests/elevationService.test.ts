// Mock logger before importing the service
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

import { ElevationService } from '../services/elevationService';

// Canonical test coordinates (from MEMORY.MD)
const TEST_START = { lat: -22.15018, lng: -42.92185 };
const TEST_END   = { lat: -22.1510,  lng: -42.9210  };

describe('ElevationService', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two close points', () => {
      const start = { lat: -23.5505, lng: -46.6333 };
      const end = { lat: -23.5506, lng: -46.6334 };
      const distance = ElevationService.calculateDistance(start, end);
      
      // Distance should be around 15 meters
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(20);
    });

    it('should return 0 for same points', () => {
      const point = { lat: -23.5505, lng: -46.6333 };
      const distance = ElevationService.calculateDistance(point, point);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should calculate distance between distant points', () => {
      const start = { lat: -23.5505, lng: -46.6333 }; // São Paulo
      const end = { lat: -22.9068, lng: -43.1729 }; // Rio de Janeiro
      const distance = ElevationService.calculateDistance(start, end);
      
      // Distance should be around 350-400km
      expect(distance).toBeGreaterThan(350000);
      expect(distance).toBeLessThan(450000);
    });

    it('should calculate distance for canonical test coordinates', () => {
      const distance = ElevationService.calculateDistance(TEST_START, TEST_END);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(5000); // Should be within a few km
    });
  });

  describe('getElevationProfile', () => {
    const mockFetch = jest.fn();

    beforeEach(() => {
      global.fetch = mockFetch as any;
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should return elevation profile on successful API response', async () => {
      const steps = 5;
      const results = Array.from({ length: steps + 1 }, (_, i) => ({ elevation: 100 + i * 2 }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results }),
      });

      const profile = await ElevationService.getElevationProfile(TEST_START, TEST_END, steps);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(profile).toHaveLength(steps + 1);
      expect(profile[0]).toHaveProperty('dist');
      expect(profile[0]).toHaveProperty('elev');
      expect(profile[0].elev).toBe(100);
      expect(profile[steps].elev).toBe(110);
    });

    it('should return profile with increasing distances', async () => {
      const steps = 4;
      const results = Array.from({ length: steps + 1 }, (_, i) => ({ elevation: 200 }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results }),
      });

      const profile = await ElevationService.getElevationProfile(TEST_START, TEST_END, steps);

      // Distances should be non-decreasing
      for (let i = 1; i < profile.length; i++) {
        expect(profile[i].dist).toBeGreaterThanOrEqual(profile[i - 1].dist);
      }
      // First point should be at dist=0
      expect(profile[0].dist).toBe(0);
    });

    it('should use default 25 steps when not specified', async () => {
      const results = Array.from({ length: 26 }, (_, i) => ({ elevation: 50 }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results }),
      });

      const profile = await ElevationService.getElevationProfile(TEST_START, TEST_END);

      expect(profile).toHaveLength(26); // steps + 1
    });

    it('should fall back to flat terrain when API returns non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const steps = 5;
      const profile = await ElevationService.getElevationProfile(TEST_START, TEST_END, steps);

      expect(profile).toHaveLength(steps + 1);
      // All elevations should be 0 (flat terrain fallback)
      profile.forEach(point => {
        expect(point.elev).toBe(0);
      });
    });

    it('should fall back to flat terrain on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const steps = 3;
      const profile = await ElevationService.getElevationProfile(TEST_START, TEST_END, steps);

      expect(profile).toHaveLength(steps + 1);
      profile.forEach(point => {
        expect(point.elev).toBe(0);
        expect(point.dist).toBeGreaterThanOrEqual(0);
      });
    });

    it('should fall back to flat terrain on timeout', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted', 'AbortError'));

      const steps = 2;
      const profile = await ElevationService.getElevationProfile(TEST_START, TEST_END, steps);

      expect(profile).toHaveLength(steps + 1);
      profile.forEach(point => expect(point.elev).toBe(0));
    });

    it('should correctly interpolate locations sent to the API', async () => {
      const steps = 2;
      const results = Array.from({ length: steps + 1 }, (_, i) => ({ elevation: i * 10 }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results }),
      });

      await ElevationService.getElevationProfile(TEST_START, TEST_END, steps);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.locations).toHaveLength(steps + 1);
      // First location should be TEST_START
      expect(callBody.locations[0].latitude).toBeCloseTo(TEST_START.lat, 5);
      expect(callBody.locations[0].longitude).toBeCloseTo(TEST_START.lng, 5);
      // Last location should be TEST_END
      expect(callBody.locations[steps].latitude).toBeCloseTo(TEST_END.lat, 5);
      expect(callBody.locations[steps].longitude).toBeCloseTo(TEST_END.lng, 5);
    });
  });
});

