import { ElevationService } from '../services/elevationService';

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
  });
});

