import { z } from 'zod';

/**
 * Sanitize a text field: strip null bytes and ASCII control characters,
 * then trim whitespace. Applied to all ABNT title block text fields to
 * prevent log injection and malformed DXF content.
 *
 * Note: all control chars (incl. tab/LF/CR) are stripped because ABNT
 * title block fields are single-line inputs — no multi-line content is
 * valid in these fields (NBR 10582 §4.1 — carimbo fields are single-line).
 */
const sanitizeText = (maxLen: number) =>
    z.string()
        .max(maxLen)
        .transform(s => s.replace(/[\x00-\x1f\x7f]/g, '').trim())
        .optional();

const dxfRequestSchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(10).max(5000),
    mode: z.enum(['circle', 'polygon', 'bbox']),
    /** Campos ABNT NBR 10582 (opcionais) — sanitizados para remoção de bytes nulos e chars de controle */
    designer:       sanitizeText(60),
    numero_desenho: sanitizeText(20),
    revisao:        sanitizeText(3),
    verificado_por: sanitizeText(60),
    aprovado_por:   sanitizeText(60),
    /** Normas ANEEL/PRODIST — substitui ABNT para camadas elétricas */
    aneel_prodist: z.boolean().optional().default(false),
});

export { dxfRequestSchema };
