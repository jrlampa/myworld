/**
 * Tests for IBGE service — core municipality/state/mesh queries
 * Covers: searchMunicipios, getMunicipioPorCodigo, getEstados,
 *         getMunicipiosPorEstado, getMalhaGeoJson
 */
import {
    searchMunicipios,
    getMunicipioPorCodigo,
    getEstados,
    getMalhaGeoJson,
    getMunicipiosPorEstado,
} from '../services/ibgeService';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('IbgeService — core', () => {
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

        it('deve mapear municipio com dados incompletos usando fallback ?? 0', async () => {
            const minimalData = [{ id: 99, nome: 'SemDados', microrregiao: null }];
            mockFetch.mockResolvedValueOnce({ ok: true, json: async () => minimalData });

            const result = await searchMunicipios('SemDados');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(99);
            expect(result[0].uf.id).toBe(0);
            expect(result[0].uf.sigla).toBe('');
            expect(result[0].microrregiao.id).toBe(0);
            expect(result[0].regiao.id).toBe(0);
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

        it('deve usar fallback ?? quando estado não tem regiao', async () => {
            const mockData = [{ id: 1, sigla: 'DF', nome: 'Distrito Federal', regiao: null }];
            mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

            const result = await getEstados();
            expect(result).toHaveLength(1);
            expect(result[0].regiao.id).toBe(0);
            expect(result[0].regiao.sigla).toBe('');
        });

        it('deve retornar array vazio quando API retorna não-array', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'fail' }) });
            const result = await getEstados();
            expect(result).toEqual([]);
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
});
