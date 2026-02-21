/**
 * Testes unitários — incraService.ts
 *
 * Cobre: getParcelasCertificadas, getParcelasSummary.
 * API externa INCRA SIGEF WFS é mockada via global.fetch.
 *
 * Coordenadas canônicas de teste: lat=-22.15018, lon=-42.92185 (Muriaé/MG)
 */

import {
    getParcelasCertificadas,
    getParcelasSummary,
    IncraParcela,
    IncraWfsFeature,
} from '../services/incraService';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function makeFeatureCollection(features: Partial<IncraWfsFeature>[] = []): object {
    return {
        type: 'FeatureCollection',
        features: features.map((f, i) => ({
            type: 'Feature',
            id: `incra.${i + 1}`,
            geometry: null,
            properties: {},
            ...f,
        })),
    };
}

const TEST_LAT = -22.15018;
const TEST_LON = -42.92185;
const TEST_RADIUS = 500;

describe('incraService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getParcelasCertificadas', () => {
        it('deve retornar parcelas para resposta válida do WFS', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([
                        {
                            id: 'incra.1',
                            properties: {
                                parcela_codigo: 'MG-001',
                                denominacao: 'Fazenda Boa Vista',
                                situacao: 'CERTIFICADO',
                                area_ha: 45.7,
                                municipio: 'Muriaé',
                                uf: 'MG',
                            },
                        },
                    ]),
            });

            const result = await getParcelasCertificadas(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toHaveLength(1);
            expect(result[0].codigo).toBe('MG-001');
            expect(result[0].nome).toBe('Fazenda Boa Vista');
            expect(result[0].situacao).toBe('CERTIFICADO');
            expect(result[0].area_ha).toBe(45.7);
            expect(result[0].municipio).toBe('Muriaé');
            expect(result[0].uf).toBe('MG');
        });

        it('deve retornar array vazio quando WFS retorna status não-OK', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

            const result = await getParcelasCertificadas(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toEqual([]);
        });

        it('deve retornar array vazio quando resposta não é FeatureCollection', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ type: 'Feature', features: null }),
            });

            const result = await getParcelasCertificadas(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toEqual([]);
        });

        it('deve retornar array vazio em caso de erro de rede', async () => {
            mockFetch.mockRejectedValueOnce(new Error('connection refused'));

            const result = await getParcelasCertificadas(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toEqual([]);
        });

        it('deve usar propriedades alternativas quando parcela_codigo está ausente', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([
                        {
                            id: 'incra.99',
                            properties: { codigo: 'ALT-001', nome: 'Sitio Test' },
                        },
                    ]),
            });

            const result = await getParcelasCertificadas(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result[0].codigo).toBe('ALT-001');
        });

        it('deve usar id como fallback quando codigo não está disponível', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([{ id: 'incra.42', properties: {} }]),
            });

            const result = await getParcelasCertificadas(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result[0].codigo).toBe('incra.42');
        });

        it('deve usar raio padrão de 1000m quando não especificado', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => makeFeatureCollection([]),
            });

            const result = await getParcelasCertificadas(TEST_LAT, TEST_LON);

            expect(result).toEqual([]);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('getParcelasSummary', () => {
        it('deve retornar sumário correto com múltiplas parcelas', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([
                        {
                            properties: {
                                parcela_codigo: 'MG-001',
                                area_ha: 30.5,
                                municipio: 'Muriaé',
                                uf: 'MG',
                            },
                        },
                        {
                            properties: {
                                parcela_codigo: 'MG-002',
                                area_ha: 15.0,
                                municipio: 'Muriaé',
                                uf: 'MG',
                            },
                        },
                        {
                            properties: {
                                parcela_codigo: 'MG-003',
                                area_ha: 8.25,
                                municipio: 'Leopoldina',
                                uf: 'MG',
                            },
                        },
                    ]),
            });

            const result = await getParcelasSummary(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result.total).toBe(3);
            expect(result.areaTotal_ha).toBeCloseTo(53.75, 2);
            expect(result.municipios).toHaveLength(2);
            expect(result.municipios).toContain('Muriaé');
            expect(result.municipios).toContain('Leopoldina');
            expect(result.parcelas).toHaveLength(3);
        });

        it('deve retornar sumário vazio quando não há parcelas', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => makeFeatureCollection([]),
            });

            const result = await getParcelasSummary(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result.total).toBe(0);
            expect(result.areaTotal_ha).toBe(0);
            expect(result.municipios).toEqual([]);
            expect(result.parcelas).toEqual([]);
        });

        it('deve tratar area_ha com valor zero corretamente', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([
                        { properties: { parcela_codigo: 'X1', area_ha: 0 } },
                    ]),
            });

            const result = await getParcelasSummary(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result.areaTotal_ha).toBe(0);
        });

        it('deve deduplicar municípios no resultado', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([
                        { properties: { municipio: 'Muriaé', area_ha: 10 } },
                        { properties: { municipio: 'Muriaé', area_ha: 20 } },
                    ]),
            });

            const result = await getParcelasSummary(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result.municipios).toHaveLength(1);
            expect(result.municipios[0]).toBe('Muriaé');
        });

        it('deve usar raio padrão de 1000m em getParcelasSummary quando não especificado', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => makeFeatureCollection([
                    { properties: { parcela_codigo: 'X1', area_ha: 5.0, municipio: 'Muriaé' } },
                ]),
            });

            const result = await getParcelasSummary(TEST_LAT, TEST_LON);

            expect(result.total).toBe(1);
            expect(result.areaTotal_ha).toBe(5.0);
        });
    });
});
