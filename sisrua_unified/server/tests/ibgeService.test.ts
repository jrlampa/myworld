/**
 * Tests for IBGE service
 */
import {
    searchMunicipios,
    getMunicipioPorCodigo,
    getEstados,
    resolveIbgeGeocode,
    getMalhaGeoJson,
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
    });
});
