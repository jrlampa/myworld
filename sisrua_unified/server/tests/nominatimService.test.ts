/**
 * Tests for Nominatim service
 */
import { searchNominatim, reverseGeocode } from '../services/nominatimService';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('NominatimService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('searchNominatim', () => {
        it('should return coordinates for a valid address', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [
                    {
                        lat: '-22.2835',
                        lon: '-42.5321',
                        display_name: 'Nova Friburgo, Rio de Janeiro, Brasil',
                        type: 'city',
                        importance: 0.7,
                    },
                ],
            });

            const result = await searchNominatim('Nova Friburgo');

            expect(result).not.toBeNull();
            expect(result?.lat).toBeCloseTo(-22.2835, 4);
            expect(result?.lng).toBeCloseTo(-42.5321, 4);
            expect(result?.label).toContain('Nova Friburgo');
        });

        it('should return null when no results found', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
            });

            const result = await searchNominatim('XYZ lugar inexistente 999');
            expect(result).toBeNull();
        });

        it('should return null on API failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
            });

            const result = await searchNominatim('qualquer coisa');
            expect(result).toBeNull();
        });

        it('should return null on network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await searchNominatim('qualquer coisa');
            expect(result).toBeNull();
        });

        it('should sanitize dangerous characters from query', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
            });

            const result = await searchNominatim('<script>alert(1)</script>');
            expect(result).toBeNull();
            // Verify fetch was called with sanitized query (no script tags)
            const calledUrl = mockFetch.mock.calls[0][0] as string;
            expect(calledUrl).not.toContain('<script>');
        });

        it('should handle empty query gracefully', async () => {
            const result = await searchNominatim('');
            expect(result).toBeNull();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('reverseGeocode', () => {
        it('should return address for valid coordinates', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    display_name: 'Rua XV de Novembro, Nova Friburgo, RJ, Brasil',
                }),
            });

            const result = await reverseGeocode(-22.2835, -42.5321);

            expect(result).not.toBeNull();
            expect(result).toContain('Nova Friburgo');
        });

        it('should return null on API failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const result = await reverseGeocode(-22.2835, -42.5321);
            expect(result).toBeNull();
        });
    });
});
