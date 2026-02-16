import { GeocodingService } from '../services/geocodingService';

describe('GeocodingService', () => {
  describe('resolveLocation', () => {
    it('should parse decimal coordinates', async () => {
      const result = await GeocodingService.resolveLocation('-23.5505, -46.6333');
      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(-23.5505, 4);
      expect(result?.lng).toBeCloseTo(-46.6333, 4);
      expect(result?.label).toContain('Lat/Lng');
    });

    it('should parse coordinates with different separators', async () => {
      const result = await GeocodingService.resolveLocation('-23.5505 -46.6333');
      expect(result).not.toBeNull();
      expect(result?.lat).toBeCloseTo(-23.5505, 4);
      expect(result?.lng).toBeCloseTo(-46.6333, 4);
    });

    it('should return null for malformed input', async () => {
      const result = await GeocodingService.resolveLocation('not-a-coordinate');
      expect(result).toBeNull();
    });

    it('should return null for single number', async () => {
      const result = await GeocodingService.resolveLocation('123.456');
      expect(result).toBeNull();
    });

    it('should parse UTM coordinates', async () => {
      const result = await GeocodingService.resolveLocation('23K 315000 7395000');
      expect(result).not.toBeNull();
      expect(result?.lat).toBeDefined();
      expect(result?.lng).toBeDefined();
      expect(result?.label).toContain('UTM');
    });

    it('should handle empty query', async () => {
      const result = await GeocodingService.resolveLocation('');
      expect(result).toBeNull();
    });

    it('should validate latitude range', async () => {
      const result = await GeocodingService.resolveLocation('91.0, -46.6333');
      expect(result).toBeNull();
    });

    it('should validate longitude range', async () => {
      const result = await GeocodingService.resolveLocation('-23.5505, 181.0');
      expect(result).toBeNull();
    });
  });
});


