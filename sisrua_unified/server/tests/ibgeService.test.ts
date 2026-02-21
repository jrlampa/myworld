/**
 * Tests for IBGE service
 */
import {
    searchMunicipios,
    getMunicipioPorCodigo,
    getEstados,
    resolveIbgeGeocode,
    getMalhaGeoJson,
    getMunicipiosPorEstado,
} from '../services/ibgeService';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('IbgeService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('searchMunicipios', () => {
        it('should return mapped municipalities on success', async () => {
            const mockData = [
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

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData,
            });

            const result = await searchMunicipios('Nova Friburgo');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(3304557);
            expect(result[0].nome).toBe('Nova Friburgo');
            expect(result[0].uf.sigla).toBe('RJ');
        });

        it('should return empty array when API fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const result = await searchMunicipios('Qualquer Cidade');
            expect(result).toEqual([]);
        });

        it('should return empty array on network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await searchMunicipios('Qualquer Cidade');
            expect(result).toEqual([]);
        });

        it('should return empty array when API returns non-array', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ error: 'something' }),
            });

            const result = await searchMunicipios('Cidade');
            expect(result).toEqual([]);
        });
    });

    describe('getMunicipioPorCodigo', () => {
        it('should return municipality for valid code', async () => {
            const mockData = {
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
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData,
            });

            const result = await getMunicipioPorCodigo(3304557);

            expect(result).not.toBeNull();
            expect(result?.id).toBe(3304557);
            expect(result?.nome).toBe('Nova Friburgo');
        });

        it('should return null on API failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            const result = await getMunicipioPorCodigo(9999999);
            expect(result).toBeNull();
        });
    });

    describe('getEstados', () => {
        it('should return list of states', async () => {
            const mockData = [
                {
                    id: 33,
                    sigla: 'RJ',
                    nome: 'Rio de Janeiro',
                    regiao: { id: 3, sigla: 'SE', nome: 'Sudeste' },
                },
                {
                    id: 35,
                    sigla: 'SP',
                    nome: 'São Paulo',
                    regiao: { id: 3, sigla: 'SE', nome: 'Sudeste' },
                },
            ];

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockData,
            });

            const result = await getEstados();

            expect(result).toHaveLength(2);
            expect(result[0].sigla).toBe('RJ');
            expect(result[1].sigla).toBe('SP');
        });
    });

    describe('resolveIbgeGeocode', () => {
        it('should resolve municipality and extract centroid', async () => {
            // First call: searchMunicipios
            const mockMunicipios = [
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

            // Second call: getMalhaGeoJson
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
                .mockResolvedValueOnce({ ok: true, json: async () => mockMunicipios })
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
            const mockMunicipios = [
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

            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => mockMunicipios })
                .mockResolvedValueOnce({ ok: false, status: 404 }); // getMalhaGeoJson fails

            const result = await resolveIbgeGeocode('Nova Friburgo');
            expect(result).toBeNull();
        });

        it('should return null when centroid cannot be extracted from empty GeoJSON', async () => {
            const mockMunicipios = [
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

            // GeoJSON with no coordinates → centroid extraction returns null
            const emptyGeojson = { type: 'FeatureCollection', features: [] };

            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => mockMunicipios })
                .mockResolvedValueOnce({ ok: true, json: async () => emptyGeojson });

            const result = await resolveIbgeGeocode('Nova Friburgo');
            expect(result).toBeNull();
        });
    });

    describe('getMunicipiosPorEstado', () => {
        it('should return municipalities for a state by sigla', async () => {
            const mockData = [
                {
                    id: 3304557,
                    nome: 'Nova Friburgo',
                    microrregiao: {
                        id: 33012,
                        nome: 'Nova Friburgo',
                        mesorregiao: {
                            id: 3304,
                            nome: 'Centro Fluminense',
                            UF: { id: 33, sigla: 'RJ', nome: 'Rio de Janeiro', regiao: { id: 3, sigla: 'SE', nome: 'Sudeste' } },
                        },
                    },
                },
            ];

            mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

            const result = await getMunicipiosPorEstado('RJ');

            expect(result).toHaveLength(1);
            expect(result[0].nome).toBe('Nova Friburgo');
        });

        it('should return municipalities for a state by numeric ID', async () => {
            const mockData = [
                {
                    id: 3550308,
                    nome: 'São Paulo',
                    microrregiao: {
                        id: 35061,
                        nome: 'São Paulo',
                        mesorregiao: {
                            id: 3515,
                            nome: 'Metropolitana de São Paulo',
                            UF: { id: 35, sigla: 'SP', nome: 'São Paulo', regiao: { id: 3, sigla: 'SE', nome: 'Sudeste' } },
                        },
                    },
                },
            ];

            mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

            const result = await getMunicipiosPorEstado(35);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(3550308);
        });

        it('should return empty array when API returns non-array', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'not found' }) });

            const result = await getMunicipiosPorEstado('XX');
            expect(result).toEqual([]);
        });

        it('should return empty array when API fails', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

            const result = await getMunicipiosPorEstado('ZZ');
            expect(result).toEqual([]);
        });
    });

    describe('getMalhaGeoJson', () => {
        it('should return GeoJSON on success', async () => {
            const mockGeojson = { type: 'FeatureCollection', features: [] };

            mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockGeojson });

            const result = await getMalhaGeoJson(3304557);
            expect(result).toEqual(mockGeojson);
        });

        it('should return null when API returns non-OK status', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

            const result = await getMalhaGeoJson(9999999);
            expect(result).toBeNull();
        });

        it('should return null on network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await getMalhaGeoJson(3304557);
            expect(result).toBeNull();
        });
    });

    describe('resolveIbgeGeocode — diverse GeoJSON geometry types', () => {
        const municipioMock = [
            {
                id: 3304557,
                nome: 'Teste',
                microrregiao: {
                    id: 33012,
                    nome: 'Teste',
                    mesorregiao: {
                        id: 3304,
                        nome: 'Teste',
                        UF: { id: 33, sigla: 'RJ', nome: 'Rio de Janeiro', regiao: { id: 3, sigla: 'SE', nome: 'Sudeste' } },
                    },
                },
            },
        ];

        async function resolveWith(geojson: object) {
            mockFetch
                .mockResolvedValueOnce({ ok: true, json: async () => municipioMock })
                .mockResolvedValueOnce({ ok: true, json: async () => geojson });
            return resolveIbgeGeocode('Teste');
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
    });
});
