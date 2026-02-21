/**
 * Tests for GeocodingService – verifies Nominatim + IBGE fallback integration
 */
import { GeocodingService } from '../services/geocodingService';

// Mock imported services
jest.mock('../services/nominatimService', () => ({
    searchNominatim: jest.fn(),
}));

jest.mock('../services/ibgeService', () => ({
    resolveIbgeGeocode: jest.fn(),
}));

import { searchNominatim } from '../services/nominatimService';
import { resolveIbgeGeocode } from '../services/ibgeService';

const mockNominatim = searchNominatim as jest.MockedFunction<typeof searchNominatim>;
const mockIbge = resolveIbgeGeocode as jest.MockedFunction<typeof resolveIbgeGeocode>;

describe('GeocodingService – extended resolution', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return lat/lng directly without calling external services', async () => {
        const result = await GeocodingService.resolveLocation('-22.15018, -42.92185');

        expect(result).not.toBeNull();
        expect(result?.lat).toBeCloseTo(-22.15018, 4);
        expect(result?.lng).toBeCloseTo(-42.92185, 4);
        expect(mockNominatim).not.toHaveBeenCalled();
        expect(mockIbge).not.toHaveBeenCalled();
    });

    it('should parse UTM 23K coordinates without calling external services', async () => {
        const result = await GeocodingService.resolveLocation('23K 788547 7634925');

        expect(result).not.toBeNull();
        expect(result?.lat).toBeDefined();
        expect(result?.lng).toBeDefined();
        expect(result?.label).toContain('UTM');
        expect(mockNominatim).not.toHaveBeenCalled();
        expect(mockIbge).not.toHaveBeenCalled();
    });

    it('should fall back to IBGE geocoding for city name', async () => {
        mockIbge.mockResolvedValueOnce({
            lat: -22.2835,
            lng: -42.5321,
            label: 'Nova Friburgo, RJ (IBGE)',
            municipio: {
                id: 3304557,
                nome: 'Nova Friburgo',
                uf: { id: 33, sigla: 'RJ', nome: 'Rio de Janeiro' },
                microrregiao: { id: 33012, nome: 'Nova Friburgo', mesorregiao: { id: 3304, nome: 'Centro Fluminense' } },
                regiao: { id: 3, sigla: 'SE', nome: 'Sudeste' },
            },
        });

        const result = await GeocodingService.resolveLocation('Nova Friburgo');

        expect(result).not.toBeNull();
        expect(result?.lat).toBeCloseTo(-22.2835, 4);
        expect(result?.label).toContain('IBGE');
        expect(mockIbge).toHaveBeenCalledWith('Nova Friburgo');
        expect(mockNominatim).not.toHaveBeenCalled();
    });

    it('should fall back to Nominatim when IBGE returns null', async () => {
        mockIbge.mockResolvedValueOnce(null);
        mockNominatim.mockResolvedValueOnce({
            lat: -22.9,
            lng: -43.1,
            label: 'Rua das Flores, Rio de Janeiro, RJ, Brasil',
            type: 'road',
            importance: 0.5,
        });

        const result = await GeocodingService.resolveLocation('Rua das Flores RJ');

        expect(result).not.toBeNull();
        expect(result?.lat).toBeCloseTo(-22.9, 4);
        expect(mockIbge).toHaveBeenCalled();
        expect(mockNominatim).toHaveBeenCalled();
    });

    it('should return null when all resolution methods fail', async () => {
        mockIbge.mockResolvedValueOnce(null);
        mockNominatim.mockResolvedValueOnce(null);

        const result = await GeocodingService.resolveLocation('lugar-nenhum xyz 999');

        expect(result).toBeNull();
        expect(mockIbge).toHaveBeenCalled();
        expect(mockNominatim).toHaveBeenCalled();
    });
});
