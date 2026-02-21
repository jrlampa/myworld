/**
 * ibgeService.ts
 * Responsabilidade: Integração com APIs públicas do IBGE (Instituto Brasileiro de
 * Geografia e Estatística).
 *
 * APIs utilizadas (gratuitas, sem chave):
 *  - Localidades: https://servicodados.ibge.gov.br/api/v1/localidades/
 *  - Malhas geográficas: https://servicodados.ibge.gov.br/api/v3/malhas/
 */

import { logger } from '../utils/logger.js';

const IBGE_BASE_URL = 'https://servicodados.ibge.gov.br/api';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_MUNICIPIO_NAME_LENGTH = 100;

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export interface IbgeMunicipio {
    id: number;
    nome: string;
    uf: {
        id: number;
        sigla: string;
        nome: string;
    };
    microrregiao: {
        id: number;
        nome: string;
        mesorregiao: {
            id: number;
            nome: string;
        };
    };
    regiao: {
        id: number;
        sigla: string;
        nome: string;
    };
}

export interface IbgeEstado {
    id: number;
    sigla: string;
    nome: string;
    regiao: {
        id: number;
        sigla: string;
        nome: string;
    };
}

// ─── Helpers internos ────────────────────────────────────────────────────────

async function fetchIbge<T>(path: string): Promise<T | null> {
    const url = `${IBGE_BASE_URL}${path}`;
    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });

        if (!response.ok) {
            logger.warn('IBGE API retornou status não-OK', { status: response.status, url });
            return null;
        }

        return (await response.json()) as T;
    } catch (error: any) {
        logger.error('Erro ao consultar API IBGE', { error: error.message, url });
        return null;
    }
}

function mapMunicipio(raw: any): IbgeMunicipio {
    return {
        id: raw.id,
        nome: raw.nome,
        uf: {
            id: raw.microrregiao?.mesorregiao?.UF?.id ?? 0,
            sigla: raw.microrregiao?.mesorregiao?.UF?.sigla ?? '',
            nome: raw.microrregiao?.mesorregiao?.UF?.nome ?? '',
        },
        microrregiao: {
            id: raw.microrregiao?.id ?? 0,
            nome: raw.microrregiao?.nome ?? '',
            mesorregiao: {
                id: raw.microrregiao?.mesorregiao?.id ?? 0,
                nome: raw.microrregiao?.mesorregiao?.nome ?? '',
            },
        },
        regiao: {
            id: raw.microrregiao?.mesorregiao?.UF?.regiao?.id ?? 0,
            sigla: raw.microrregiao?.mesorregiao?.UF?.regiao?.sigla ?? '',
            nome: raw.microrregiao?.mesorregiao?.UF?.regiao?.nome ?? '',
        },
    };
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Busca municípios pelo nome (parcial ou completo).
 * Retorna até 10 resultados.
 */
export async function searchMunicipios(nome: string): Promise<IbgeMunicipio[]> {
    const encoded = encodeURIComponent(nome.trim().slice(0, MAX_MUNICIPIO_NAME_LENGTH));
    const raw = await fetchIbge<any[]>(`/v1/localidades/municipios?nome=${encoded}&orderBy=nome`);

    if (!Array.isArray(raw)) return [];

    return raw.slice(0, 10).map(mapMunicipio);
}

/**
 * Retorna os dados de um município pelo código IBGE.
 */
export async function getMunicipioPorCodigo(codigo: number): Promise<IbgeMunicipio | null> {
    const raw = await fetchIbge<any>(`/v1/localidades/municipios/${codigo}`);
    if (!raw || !raw.id) return null;
    return mapMunicipio(raw);
}

/**
 * Lista todos os estados brasileiros.
 */
export async function getEstados(): Promise<IbgeEstado[]> {
    const raw = await fetchIbge<any[]>('/v1/localidades/estados?orderBy=nome');
    if (!Array.isArray(raw)) return [];

    return raw.map((e: any) => ({
        id: e.id,
        sigla: e.sigla,
        nome: e.nome,
        regiao: {
            id: e.regiao?.id ?? 0,
            sigla: e.regiao?.sigla ?? '',
            nome: e.regiao?.nome ?? '',
        },
    }));
}

/**
 * Retorna municípios de um estado pelo ID ou sigla da UF.
 */
export async function getMunicipiosPorEstado(uf: string | number): Promise<IbgeMunicipio[]> {
    const raw = await fetchIbge<any[]>(`/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
    if (!Array.isArray(raw)) return [];
    return raw.map(mapMunicipio);
}

/**
 * Retorna a malha geográfica (GeoJSON) de um município pelo código IBGE.
 * Útil para renderizar o contorno do município no mapa.
 */
export async function getMalhaGeoJson(codigoMunicipio: number): Promise<object | null> {
    const url = `${IBGE_BASE_URL}/v3/malhas/municipios/${codigoMunicipio}?formato=application/json`;
    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });

        if (!response.ok) {
            logger.warn('IBGE Malhas: status não-OK', { status: response.status, codigoMunicipio });
            return null;
        }

        return await response.json();
    } catch (error: any) {
        logger.error('Erro ao buscar malha IBGE', { error: error.message, codigoMunicipio });
        return null;
    }
}

/**
 * Resolve o nome de um município para coordenadas aproximadas usando a API de
 * localidades do IBGE combinada com o centróide da malha geográfica.
 * Retorna null se não encontrar resultado.
 */
export async function resolveIbgeGeocode(query: string): Promise<{ lat: number; lng: number; label: string; municipio: IbgeMunicipio } | null> {
    const municipios = await searchMunicipios(query);
    if (municipios.length === 0) return null;

    const municipio = municipios[0];
    const geojson: any = await getMalhaGeoJson(municipio.id);

    if (!geojson) return null;

    // Extrai centróide das coordenadas do GeoJSON
    const centroid = extractCentroid(geojson);
    if (!centroid) return null;

    return {
        lat: centroid.lat,
        lng: centroid.lng,
        label: `${municipio.nome}, ${municipio.uf.sigla} (IBGE)`,
        municipio,
    };
}

/**
 * Calcula centróide simples de um GeoJSON (Feature ou FeatureCollection).
 */
function extractCentroid(geojson: any): { lat: number; lng: number } | null {
    try {
        let coords: number[][] = [];

        const collectCoords = (geometry: any) => {
            if (!geometry) return;
            const { type, coordinates } = geometry;
            if (type === 'Point') {
                coords.push(coordinates);
            } else if (type === 'LineString' || type === 'MultiPoint') {
                coords.push(...coordinates);
            } else if (type === 'Polygon' || type === 'MultiLineString') {
                for (const ring of coordinates) coords.push(...ring);
            } else if (type === 'MultiPolygon') {
                for (const polygon of coordinates)
                    for (const ring of polygon) coords.push(...ring);
            } else if (type === 'GeometryCollection') {
                for (const g of geometry.geometries) collectCoords(g);
            }
        };

        if (geojson.type === 'FeatureCollection') {
            for (const feature of geojson.features) collectCoords(feature.geometry);
        } else if (geojson.type === 'Feature') {
            collectCoords(geojson.geometry);
        } else {
            collectCoords(geojson);
        }

        if (coords.length === 0) return null;

        const sumLng = coords.reduce((s, c) => s + c[0], 0);
        const sumLat = coords.reduce((s, c) => s + c[1], 0);

        return {
            lat: sumLat / coords.length,
            lng: sumLng / coords.length,
        };
    } catch {
        return null;
    }
}
