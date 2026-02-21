/**
 * nominatimService.ts
 * Responsabilidade: Geocodificação de endereços via Nominatim (OSM) - serviço gratuito.
 * Retorna coordenadas geográficas a partir de consultas textuais.
 */

import { logger } from '../utils/logger.js';

export interface NominatimResult {
    lat: number;
    lng: number;
    label: string;
    type: string;
    importance: number;
}

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'sisRUA/1.0 (https://github.com/jrlampa/myworld; contact@sisrua.app)';

/**
 * Sanitiza a query antes de enviar para o Nominatim.
 * Remove caracteres perigosos e normaliza espaços.
 */
function sanitizeQuery(query: string): string {
    return query
        .replace(/[<>"'`]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300);
}

/**
 * Busca endereço ou local via Nominatim, restrito ao Brasil (countrycodes=br).
 */
export async function searchNominatim(query: string): Promise<NominatimResult | null> {
    const sanitized = sanitizeQuery(query);
    if (!sanitized) return null;

    const params = new URLSearchParams({
        q: sanitized,
        format: 'json',
        limit: '1',
        countrycodes: 'br',
        addressdetails: '1',
    });

    const url = `${NOMINATIM_BASE_URL}/search?${params.toString()}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });

        if (!response.ok) {
            logger.warn('Nominatim retornou status não-OK', { status: response.status, query: sanitized });
            return null;
        }

        const data: any[] = await response.json();
        if (!Array.isArray(data) || data.length === 0) {
            logger.info('Nominatim: nenhum resultado encontrado', { query: sanitized });
            return null;
        }

        const first = data[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            logger.warn('Nominatim: coordenadas inválidas no resultado', { result: first });
            return null;
        }

        return {
            lat,
            lng,
            label: first.display_name || sanitized,
            type: first.type || 'unknown',
            importance: parseFloat(first.importance) || 0,
        };
    } catch (error: any) {
        logger.error('Erro ao consultar Nominatim', { error: error.message, query: sanitized });
        return null;
    }
}

/**
 * Geocodificação reversa: obtém endereço a partir de coordenadas.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: 'json',
        addressdetails: '1',
        zoom: '16',
    });

    const url = `${NOMINATIM_BASE_URL}/reverse?${params.toString()}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });

        if (!response.ok) {
            logger.warn('Nominatim reverse: status não-OK', { status: response.status, lat, lng });
            return null;
        }

        const data: any = await response.json();
        return data?.display_name || null;
    } catch (error: any) {
        logger.error('Erro na geocodificação reversa Nominatim', { error: error.message, lat, lng });
        return null;
    }
}
