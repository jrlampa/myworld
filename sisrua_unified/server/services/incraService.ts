/**
 * incraService.ts
 * Responsabilidade: Integração com serviços públicos do INCRA (Instituto Nacional de
 * Colonização e Reforma Agrária).
 *
 * Serviços utilizados (gratuitos/públicos):
 *  - SIGEF WFS: https://acervofundiario.incra.gov.br/i3geo/ogc.php?tema=sigef_publico
 *  - Parcelas certificadas do Sistema de Gestão Fundiária (SIGEF)
 *
 * Referência: https://sigef.incra.gov.br/
 */

import { logger } from '../utils/logger.js';

const INCRA_SIGEF_WFS = 'https://acervofundiario.incra.gov.br/i3geo/ogc.php';
const DEFAULT_TIMEOUT_MS = 15_000;

// ─── Tipos públicos ──────────────────────────────────────────────────────────

export interface IncraParcela {
    codigo: string;
    nome: string;
    situacao: string;
    area_ha: number;
    municipio: string;
    uf: string;
    geometry?: object | null;
}

export interface IncraWfsFeature {
    type: 'Feature';
    id: string;
    geometry: object | null;
    properties: Record<string, unknown>;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/**
 * Monta bounding box a partir de coordenadas centrais e raio em metros (aproximado).
 */
function buildBbox(lat: number, lng: number, radiusMeters: number): string {
    const degPerMeter = 1 / 111_320;
    const deltaLat = radiusMeters * degPerMeter;
    const deltaLng = radiusMeters * degPerMeter / Math.cos((lat * Math.PI) / 180);

    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;
    const minLng = lng - deltaLng;
    const maxLng = lng + deltaLng;

    return `${minLng},${minLat},${maxLng},${maxLat}`;
}

/**
 * Consulta o WFS do INCRA SIGEF.
 */
async function queryIncraWfs(
    bbox: string,
    maxFeatures: number = 50
): Promise<IncraWfsFeature[]> {
    const params = new URLSearchParams({
        tema: 'sigef_publico',
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
        BBOX: `${bbox},EPSG:4326`,
        maxFeatures: String(maxFeatures),
    });

    const url = `${INCRA_SIGEF_WFS}?${params.toString()}`;

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });

        if (!response.ok) {
            logger.warn('INCRA SIGEF WFS: status não-OK', { status: response.status });
            return [];
        }

        const data: any = await response.json();

        if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
            logger.warn('INCRA SIGEF WFS: resposta inesperada');
            return [];
        }

        return data.features as IncraWfsFeature[];
    } catch (error: any) {
        logger.error('Erro ao consultar WFS INCRA SIGEF', { error: error.message });
        return [];
    }
}

function mapFeatureToParcela(f: IncraWfsFeature): IncraParcela {
    const p = f.properties;
    return {
        codigo: String(p?.parcela_codigo ?? p?.codigo ?? f.id ?? ''),
        nome: String(p?.denominacao ?? p?.nome ?? ''),
        situacao: String(p?.situacao ?? ''),
        area_ha: Number(p?.area_ha ?? p?.area ?? 0),
        municipio: String(p?.municipio ?? ''),
        uf: String(p?.uf ?? ''),
        geometry: f.geometry,
    };
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Busca parcelas certificadas do SIGEF/INCRA próximas às coordenadas.
 */
export async function getParcelasCertificadas(
    lat: number,
    lng: number,
    radiusMeters: number = 1000
): Promise<IncraParcela[]> {
    const bbox = buildBbox(lat, lng, radiusMeters);
    const features = await queryIncraWfs(bbox, 100);

    const parcelas = features.map(mapFeatureToParcela);

    logger.info('INCRA: parcelas certificadas obtidas', {
        lat,
        lng,
        radiusMeters,
        count: parcelas.length,
    });

    return parcelas;
}

/**
 * Retorna resumo das parcelas fundiárias próximas ao ponto informado.
 */
export async function getParcelasSummary(
    lat: number,
    lng: number,
    radiusMeters: number = 1000
): Promise<{
    total: number;
    areaTotal_ha: number;
    municipios: string[];
    parcelas: IncraParcela[];
}> {
    const parcelas = await getParcelasCertificadas(lat, lng, radiusMeters);

    const areaTotal_ha = parcelas.reduce((sum, p) => sum + (p.area_ha || 0), 0);
    const municipios = [...new Set(parcelas.map((p) => p.municipio).filter(Boolean))];

    return {
        total: parcelas.length,
        areaTotal_ha: parseFloat(areaTotal_ha.toFixed(4)),
        municipios,
        parcelas,
    };
}
