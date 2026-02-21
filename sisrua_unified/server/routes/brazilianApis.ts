/**
 * brazilianApis.ts
 * Responsabilidade: Rotas para integração com APIs governamentais brasileiras
 * (IBGE, DNIT, INCRA) e geocodificação via Nominatim.
 *
 * Todos os serviços são públicos e gratuitos (zero custo).
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import {
    searchMunicipios,
    getMunicipioPorCodigo,
    getEstados,
    getMunicipiosPorEstado,
    getMalhaGeoJson,
} from '../services/ibgeService.js';
import {
    getRodoviasSummary,
    getObrasArteEspeciais,
} from '../services/dnitService.js';
import { getParcelasSummary } from '../services/incraService.js';
import {
    searchNominatim,
    reverseGeocode,
} from '../services/nominatimService.js';

const router = Router();

// ─── Schemas de validação ─────────────────────────────────────────────────────

const coordsQuerySchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(100).max(50_000).optional().default(1000),
});

const municipioNomeSchema = z.object({
    nome: z.string().min(2).max(100).trim(),
});

const municipioCodigoSchema = z.object({
    codigo: z.coerce.number().int().positive(),
});

const ufSchema = z.object({
    uf: z.string().min(2).max(10).trim(),
});

const nominatimQuerySchema = z.object({
    q: z.string().min(2).max(300).trim(),
});

const reverseGeocodeSchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
});

// ─── Utilitário: tratamento de erros ─────────────────────────────────────────

function handleValidationError(res: Response, error: z.ZodError): void {
    res.status(400).json({
        error: 'Parâmetros inválidos',
        detalhes: error.issues.map((i) => i.message).join(', '),
    });
}

function handleServerError(res: Response, error: any, contexto: string): void {
    logger.error(`Erro em ${contexto}`, { error: error.message });
    res.status(500).json({ error: 'Erro interno do servidor' });
}

// ─── IBGE – Municípios ────────────────────────────────────────────────────────

/**
 * GET /api/ibge/municipios?nome={nome}
 * Busca municípios brasileiros pelo nome.
 */
router.get('/api/ibge/municipios', async (req: Request, res: Response) => {
    const validation = municipioNomeSchema.safeParse(req.query);
    if (!validation.success) {
        return handleValidationError(res, validation.error);
    }

    try {
        const { nome } = validation.data;
        logger.info('IBGE: busca de municípios', { nome });
        const municipios = await searchMunicipios(nome);
        return res.json({ municipios, total: municipios.length });
    } catch (error: any) {
        return handleServerError(res, error, 'IBGE busca municípios');
    }
});

/**
 * GET /api/ibge/municipios/:codigo
 * Retorna dados de um município pelo código IBGE.
 */
router.get('/api/ibge/municipios/:codigo', async (req: Request, res: Response) => {
    const validation = municipioCodigoSchema.safeParse({ codigo: req.params.codigo });
    if (!validation.success) {
        return handleValidationError(res, validation.error);
    }

    try {
        const { codigo } = validation.data;
        logger.info('IBGE: busca município por código', { codigo });
        const municipio = await getMunicipioPorCodigo(codigo);

        if (!municipio) {
            return res.status(404).json({ error: 'Município não encontrado' });
        }

        return res.json(municipio);
    } catch (error: any) {
        return handleServerError(res, error, 'IBGE município por código');
    }
});

/**
 * GET /api/ibge/municipios/:codigo/malha
 * Retorna a malha geográfica (GeoJSON) de um município.
 */
router.get('/api/ibge/municipios/:codigo/malha', async (req: Request, res: Response) => {
    const validation = municipioCodigoSchema.safeParse({ codigo: req.params.codigo });
    if (!validation.success) {
        return handleValidationError(res, validation.error);
    }

    try {
        const { codigo } = validation.data;
        logger.info('IBGE: busca malha geográfica', { codigo });
        const malha = await getMalhaGeoJson(codigo);

        if (!malha) {
            return res.status(404).json({ error: 'Malha geográfica não encontrada' });
        }

        return res.json(malha);
    } catch (error: any) {
        return handleServerError(res, error, 'IBGE malha geográfica');
    }
});

/**
 * GET /api/ibge/estados
 * Lista todos os estados brasileiros.
 */
router.get('/api/ibge/estados', async (_req: Request, res: Response) => {
    try {
        logger.info('IBGE: listagem de estados');
        const estados = await getEstados();
        return res.json({ estados, total: estados.length });
    } catch (error: any) {
        return handleServerError(res, error, 'IBGE estados');
    }
});

/**
 * GET /api/ibge/estados/:uf/municipios
 * Lista municípios de um estado.
 */
router.get('/api/ibge/estados/:uf/municipios', async (req: Request, res: Response) => {
    const validation = ufSchema.safeParse({ uf: req.params.uf });
    if (!validation.success) {
        return handleValidationError(res, validation.error);
    }

    try {
        const { uf } = validation.data;
        logger.info('IBGE: municípios por estado', { uf });
        const municipios = await getMunicipiosPorEstado(uf);
        return res.json({ municipios, total: municipios.length });
    } catch (error: any) {
        return handleServerError(res, error, 'IBGE municípios por estado');
    }
});

// ─── DNIT – Malha Rodoviária ──────────────────────────────────────────────────

/**
 * GET /api/dnit/rodovias?lat={lat}&lng={lng}&radius={radius}
 * Retorna rodovias federais próximas às coordenadas.
 */
router.get('/api/dnit/rodovias', async (req: Request, res: Response) => {
    const validation = coordsQuerySchema.safeParse(req.query);
    if (!validation.success) {
        return handleValidationError(res, validation.error);
    }

    try {
        const { lat, lng, radius } = validation.data;
        logger.info('DNIT: busca de rodovias', { lat, lng, radius });
        const summary = await getRodoviasSummary(lat, lng, radius);
        return res.json(summary);
    } catch (error: any) {
        return handleServerError(res, error, 'DNIT rodovias');
    }
});

/**
 * GET /api/dnit/obras?lat={lat}&lng={lng}&radius={radius}
 * Retorna obras de arte especiais (pontes, viadutos, túneis) próximas.
 */
router.get('/api/dnit/obras', async (req: Request, res: Response) => {
    const validation = coordsQuerySchema.safeParse(req.query);
    if (!validation.success) {
        return handleValidationError(res, validation.error);
    }

    try {
        const { lat, lng, radius } = validation.data;
        logger.info('DNIT: busca de obras de arte', { lat, lng, radius });
        const obras = await getObrasArteEspeciais(lat, lng, radius);
        return res.json({ obras, total: obras.length });
    } catch (error: any) {
        return handleServerError(res, error, 'DNIT obras de arte');
    }
});

// ─── INCRA – Sistema Fundiário ────────────────────────────────────────────────

/**
 * GET /api/incra/parcelas?lat={lat}&lng={lng}&radius={radius}
 * Retorna parcelas certificadas do INCRA próximas às coordenadas.
 */
router.get('/api/incra/parcelas', async (req: Request, res: Response) => {
    const validation = coordsQuerySchema.safeParse(req.query);
    if (!validation.success) {
        return handleValidationError(res, validation.error);
    }

    try {
        const { lat, lng, radius } = validation.data;
        logger.info('INCRA: busca de parcelas certificadas', { lat, lng, radius });
        const summary = await getParcelasSummary(lat, lng, radius);
        return res.json(summary);
    } catch (error: any) {
        return handleServerError(res, error, 'INCRA parcelas');
    }
});

// ─── Nominatim – Geocodificação ───────────────────────────────────────────────

/**
 * GET /api/geocode?q={query}
 * Geocodificação de endereços brasileiros via Nominatim (OSM).
 */
router.get('/api/geocode', async (req: Request, res: Response) => {
    const validation = nominatimQuerySchema.safeParse(req.query);
    if (!validation.success) {
        return handleValidationError(res, validation.error);
    }

    try {
        const { q } = validation.data;
        logger.info('Nominatim: geocodificação', { query: q });
        const result = await searchNominatim(q);

        if (!result) {
            return res.status(404).json({ error: 'Endereço não encontrado' });
        }

        return res.json(result);
    } catch (error: any) {
        return handleServerError(res, error, 'Nominatim geocodificação');
    }
});

/**
 * GET /api/geocode/reverse?lat={lat}&lng={lng}
 * Geocodificação reversa: coordenadas para endereço.
 */
router.get('/api/geocode/reverse', async (req: Request, res: Response) => {
    const validation = reverseGeocodeSchema.safeParse(req.query);
    if (!validation.success) {
        return handleValidationError(res, validation.error);
    }

    try {
        const { lat, lng } = validation.data;
        logger.info('Nominatim: geocodificação reversa', { lat, lng });
        const address = await reverseGeocode(lat, lng);

        if (!address) {
            return res.status(404).json({ error: 'Endereço não encontrado para as coordenadas' });
        }

        return res.json({ address, lat, lng });
    } catch (error: any) {
        return handleServerError(res, error, 'Nominatim geocodificação reversa');
    }
});

export default router;
