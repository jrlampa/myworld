import { z } from 'zod';

const dxfRequestSchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(10).max(5000),
    mode: z.enum(['circle', 'polygon', 'bbox']),
    /** Campos ABNT NBR 10582 (opcionais) */
    designer: z.string().max(60).optional(),
    numero_desenho: z.string().max(20).optional(),
    revisao: z.string().max(3).optional(),
    verificado_por: z.string().max(60).optional(),
    aprovado_por: z.string().max(60).optional(),
    /** Normas ANEEL/PRODIST — substitui ABNT para camadas elétricas */
    aneel_prodist: z.boolean().optional().default(false),
});

export { dxfRequestSchema };
