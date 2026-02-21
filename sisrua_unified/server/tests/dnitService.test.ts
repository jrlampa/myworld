/**
 * Testes unitários — dnitService.ts
 *
 * Cobre: getRodoviasFederais, getObrasArteEspeciais, getRodoviasSummary.
 * API externa DNIT WFS é mockada via global.fetch.
 *
 * Coordenadas canônicas de teste: lat=-22.15018, lon=-42.92185 (Muriaé/MG)
 */

import {
    getRodoviasFederais,
    getObrasArteEspeciais,
    getRodoviasSummary,
    DnitWfsFeature,
} from '../services/dnitService';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function makeFeatureCollection(features: Partial<DnitWfsFeature>[] = []): object {
    return {
        type: 'FeatureCollection',
        features: features.map((f, i) => ({
            type: 'Feature',
            id: `dnit.${i + 1}`,
            geometry: null,
            properties: {},
            ...f,
        })),
    };
}

const TEST_LAT = -22.15018;
const TEST_LON = -42.92185;
const TEST_RADIUS = 500;

describe('dnitService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getRodoviasFederais', () => {
        it('deve retornar features para resposta válida do WFS', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([
                        { properties: { vl_br: 'BR-116', sg_rodovia: 'BR-116' } },
                        { properties: { vl_br: 'BR-040', sg_rodovia: 'BR-040' } },
                    ]),
            });

            const result = await getRodoviasFederais(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toHaveLength(2);
            expect(result[0].properties?.vl_br).toBe('BR-116');
        });

        it('deve retornar array vazio quando WFS retorna status não-OK', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

            const result = await getRodoviasFederais(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toEqual([]);
        });

        it('deve retornar array vazio quando resposta não é FeatureCollection', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ type: 'Feature', features: null }),
            });

            const result = await getRodoviasFederais(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toEqual([]);
        });

        it('deve retornar array vazio em caso de erro de rede', async () => {
            mockFetch.mockRejectedValueOnce(new Error('network error'));

            const result = await getRodoviasFederais(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toEqual([]);
        });

        it('deve retornar array vazio quando features é null', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ type: 'FeatureCollection', features: null }),
            });

            const result = await getRodoviasFederais(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toEqual([]);
        });

        it('deve usar raio padrão de 1000m quando não especificado', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => makeFeatureCollection([]),
            });

            const result = await getRodoviasFederais(TEST_LAT, TEST_LON);

            expect(result).toEqual([]);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('getObrasArteEspeciais', () => {
        it('deve retornar obras de arte especiais', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([
                        { properties: { tipo: 'PONTE', nome: 'Ponte do Rio' } },
                    ]),
            });

            const result = await getObrasArteEspeciais(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toHaveLength(1);
            expect(result[0].properties?.tipo).toBe('PONTE');
        });

        it('deve retornar array vazio em caso de erro', async () => {
            mockFetch.mockRejectedValueOnce(new Error('timeout'));

            const result = await getObrasArteEspeciais(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result).toEqual([]);
        });

        it('deve usar raio padrão de 1000m quando não especificado', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => makeFeatureCollection([]),
            });

            const result = await getObrasArteEspeciais(TEST_LAT, TEST_LON);

            expect(result).toEqual([]);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('getRodoviasSummary', () => {
        it('deve retornar sumário correto com rodovias distintas', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([
                        { properties: { vl_br: 'BR-116' } },
                        { properties: { vl_br: 'BR-116' } },
                        { properties: { vl_br: 'BR-040' } },
                    ]),
            });

            const result = await getRodoviasSummary(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result.totalTrechos).toBe(3);
            expect(result.rodovias).toHaveLength(2);
            expect(result.rodovias).toContain('BR-116');
            expect(result.rodovias).toContain('BR-040');
            expect(result.features).toHaveLength(3);
        });

        it('deve retornar sumário vazio quando não há rodovias', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => makeFeatureCollection([]),
            });

            const result = await getRodoviasSummary(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result.totalTrechos).toBe(0);
            expect(result.rodovias).toEqual([]);
            expect(result.features).toEqual([]);
        });

        it('deve usar sg_rodovia quando vl_br está ausente', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([
                        { properties: { sg_rodovia: 'SP-300' } },
                    ]),
            });

            const result = await getRodoviasSummary(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result.rodovias).toContain('SP-300');
        });

        it('deve ignorar properties sem código de rodovia', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () =>
                    makeFeatureCollection([
                        { properties: {} },
                        { properties: { vl_br: 'BR-116' } },
                    ]),
            });

            const result = await getRodoviasSummary(TEST_LAT, TEST_LON, TEST_RADIUS);

            expect(result.rodovias).toEqual(['BR-116']);
        });

        it('deve usar raio padrão de 1000m quando não especificado', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => makeFeatureCollection([]),
            });

            const result = await getRodoviasSummary(TEST_LAT, TEST_LON);

            expect(result.totalTrechos).toBe(0);
            expect(result.rodovias).toEqual([]);
        });
    });
});
