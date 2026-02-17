import { z } from 'zod';

const dxfRequestSchema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(10).max(5000),
    mode: z.enum(['circle', 'polygon', 'bbox'])
});

export { dxfRequestSchema };
