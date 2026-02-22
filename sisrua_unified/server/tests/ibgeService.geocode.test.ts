/**
 * Tests for IBGE service — geocoding and diverse GeoJSON geometry types
 * Covers: resolveIbgeGeocode, extractCentroid geometry variants
 */
import {
    resolveIbgeGeocode,
} from '../services/ibgeService';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const municipioMock = [
    {
        id: 3304557,
        nome: 'Nova Friburgo',
        microrregiao: {
            id: 33012,
            nome: 'Nova Friburgo',
            mesorregiao: {
                id: 3304,
                nome: 'Centro Fluminense',
                UF: {
                    id: 33,
                    sigla: 'RJ',
                    nome: 'Rio de Janeiro',
                    regiao: { id: 3, sigla: 'SE', nome: 'Sudeste' },
                },
            },
        },
    },
];

describe('IbgeService — geocode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('resolveIbgeGeocode', () => {
        it('should resolve municipality and extract centroid', async () => {
            const mockMalha = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [
                                [
                                    [-42.93, -22.16],
                                    [-42.90, -22.16],
                                    [-42.90, -22.13],
                                    [-42.93, -22.13],
                                    [-42.93, -22.16],
                                ],
                            ],
                        },
                    },
                ],
            };

            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => municipioMock })
                .mockResolvedValueOnce({ ok: true, json: async () => mockMalha });

            const result = await resolveIbgeGeocode('Nova Friburgo');

            expect(result).not.toBeNull();
            expect(result?.municipio.nome).toBe('Nova Friburgo');
            expect(result?.lat).toBeDefined();
            expect(result?.lng).toBeDefined();
            expect(result?.label).toContain('Nova Friburgo');
            expect(result?.label).toContain('RJ');
        });

        it('should return null when municipality not found', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => [],
            });

            const result = await resolveIbgeGeocode('Cidade Inexistente XYZ');
            expect(result).toBeNull();
        });

        it('should return null when malha GeoJSON is not found', async () => {
            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => municipioMock })
                .mockResolvedValueOnce({ ok: false, status: 404 });

            const result = await resolveIbgeGeocode('Nova Friburgo');
            expect(result).toBeNull();
        });

        it('should return null when centroid cannot be extracted from empty GeoJSON', async () => {
            const emptyGeojson = { type: 'FeatureCollection', features: [] };

            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => municipioMock })
                .mockResolvedValueOnce({ ok: true, json: async () => emptyGeojson });

            const result = await resolveIbgeGeocode('Nova Friburgo');
            expect(result).toBeNull();
        });
    });

    describe('resolveIbgeGeocode — diverse GeoJSON geometry types', () => {
        async function resolveWith(geojson: object) {
            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => municipioMock })
                .mockResolvedValueOnce({ ok: true, json: async () => geojson });
            return resolveIbgeGeocode('Nova Friburgo');
        }

        it('should extract centroid from Point geometry', async () => {
            const geojson = { type: 'Point', coordinates: [-42.92, -22.15] };
            const result = await resolveWith(geojson);
            expect(result).not.toBeNull();
            expect(result?.lat).toBeCloseTo(-22.15, 2);
        });

        it('should extract centroid from LineString geometry', async () => {
            const geojson = {
                type: 'LineString',
                coordinates: [[-42.92, -22.15], [-42.90, -22.13]],
            };
            const result = await resolveWith(geojson);
            expect(result).not.toBeNull();
        });

        it('should extract centroid from MultiPolygon geometry', async () => {
            const geojson = {
                type: 'MultiPolygon',
                coordinates: [
                    [[[-42.93, -22.16], [-42.90, -22.16], [-42.90, -22.13], [-42.93, -22.13], [-42.93, -22.16]]],
                ],
            };
            const result = await resolveWith(geojson);
            expect(result).not.toBeNull();
        });

        it('should extract centroid from GeometryCollection', async () => {
            const geojson = {
                type: 'GeometryCollection',
                geometries: [
                    { type: 'Point', coordinates: [-42.92, -22.15] },
                ],
            };
            const result = await resolveWith(geojson);
            expect(result).not.toBeNull();
        });

        it('should extract centroid from Feature (not FeatureCollection)', async () => {
            const geojson = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        [[-42.93, -22.16], [-42.90, -22.16], [-42.90, -22.13], [-42.93, -22.13], [-42.93, -22.16]],
                    ],
                },
            };
            const result = await resolveWith(geojson);
            expect(result).not.toBeNull();
        });

        it('should return null when malformed geojson causes exception in extractCentroid', async () => {
            const geojson = { type: 'FeatureCollection', features: null };
            const result = await resolveWith(geojson as any);
            expect(result).toBeNull();
        });

        it('should ignore feature with null geometry in FeatureCollection', async () => {
            const geojson = {
                type: 'FeatureCollection',
                features: [
                    { geometry: null },
                    { geometry: { type: 'Point', coordinates: [-42.92, -22.15] } },
                ],
            };
            const result = await resolveWith(geojson);
            expect(result).not.toBeNull();
            expect(result?.lat).toBeCloseTo(-22.15, 2);
        });
    });
});
