/**
 * dnitService.ts
 * Responsabilidade: Integração com serviços públicos do DNIT (Departamento Nacional
 * de Infraestrutura de Transportes).
 *
 * Serviços utilizados (gratuitos/públicos):
 *  - WMS/WFS DNIT GeoServer: http://maps2.dnit.gov.br/geoserver/ows
 *  - Cobertura: malha rodoviária federal (SNV - Sistema Nacional de Viação)
 *
 * Referência: https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/snv
 */

import { logger } from '../utils/logger.js';

const DNIT_GEOSERVER = 'http://maps2.dnit.gov.br/geoserver/ows';
const DEFAULT_TIMEOUT_MS = 15_000;

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export interface DnitRodovia {
    codigo: string;
    tipo: string;
    jurisdicao: string;
    situacao: string;
    geometriaWkt?: string;
}

export interface DnitWfsFeature {
    type: 'Feature';
    id: string;
    geometry: object | null;
    properties: Record<string, unknown>;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/**
 * Monta bounding box a partir de coordenadas centrais e raio em metros (aproximado).
 * Ordem WFS 1.1.0 EPSG:4326: minLng,minLat,maxLng,maxLat
 */
function buildBbox(lat: number, lng: number, radiusMeters: number): string {
    const degPerMeter = 1 / 111_320;
    const deltaLat = radiusMeters * degPerMeter;
    const deltaLng = radiusMeters * degPerMeter / Math.cos((lat * Math.PI) / 180);

    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;
    const minLng = lng - deltaLng;
    const maxLng = lng + deltaLng;

    // WFS 1.1.0 BBOX order for EPSG:4326: minLng,minLat,maxLng,maxLat
    return `${minLng},${minLat},${maxLng},${maxLat}`;
}

/**
 * Consulta o WFS do DNIT para obter feições dentro de um bounding box.
 */
async function queryWfs(
    typeName: string,
    bbox: string,
    /* istanbul ignore next */
    maxFeatures: number = 50
): Promise<DnitWfsFeature[]> {
    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        typeName,
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
        BBOX: `${bbox},EPSG:4326`,
        maxFeatures: String(maxFeatures),
    });

    const url = `${DNIT_GEOSERVER}?${params.toString()}`;

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });

        if (!response.ok) {
            logger.warn('DNIT WFS retornou status não-OK', { status: response.status, typeName });
            return [];
        }

        const data: any = await response.json();

        if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
            logger.warn('DNIT WFS: resposta inesperada', { typeName, data });
            return [];
        }

        return data.features as DnitWfsFeature[];
    } catch (error: any) {
        logger.error('Erro ao consultar WFS DNIT', { error: error.message, typeName });
        return [];
    }
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Retorna trechos da malha rodoviária federal (SNV) próximos às coordenadas.
 * Camada: "DNIT:snv" ou equivalente disponível no GeoServer.
 */
export async function getRodoviasFederais(
    lat: number,
    lng: number,
    radiusMeters: number = 1000
): Promise<DnitWfsFeature[]> {
    const bbox = buildBbox(lat, lng, radiusMeters);
    const features = await queryWfs('DNIT:snv', bbox, 100);

    logger.info('DNIT: rodovias federais obtidas', {
        lat,
        lng,
        radiusMeters,
        count: features.length,
    });

    return features;
}

/**
 * Retorna obras de arte especiais (pontes, viadutos, túneis) próximas às coordenadas.
 */
export async function getObrasArteEspeciais(
    lat: number,
    lng: number,
    radiusMeters: number = 1000
): Promise<DnitWfsFeature[]> {
    const bbox = buildBbox(lat, lng, radiusMeters);
    const features = await queryWfs('DNIT:oae_federal', bbox, 50);

    logger.info('DNIT: obras de arte especiais obtidas', {
        lat,
        lng,
        radiusMeters,
        count: features.length,
    });

    return features;
}

/**
 * Retorna resumo da malha viária federal próxima ao ponto informado.
 */
export async function getRodoviasSummary(
    lat: number,
    lng: number,
    radiusMeters: number = 1000
): Promise<{
    totalTrechos: number;
    rodovias: string[];
    features: DnitWfsFeature[];
}> {
    const features = await getRodoviasFederais(lat, lng, radiusMeters);

    const rodovias = [
        ...new Set(
            features
                .map((f) => String(f.properties?.vl_br ?? f.properties?.sg_rodovia ?? ''))
                .filter(Boolean)
        ),
    ];

    return {
        totalTrechos: features.length,
        rodovias,
        features,
    };
}
