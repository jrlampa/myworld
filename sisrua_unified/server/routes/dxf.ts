import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import {
    createCacheKey,
    deleteCachedFilename,
    getCachedFilename,
    setCachedFilename
} from '../services/cacheService.js';
import { createDxfTask } from '../services/cloudTasksService.js';
import { createJob } from '../services/jobStatusService.js';
import { scheduleDxfDeletion } from '../services/dxfCleanupService.js';
import { generateDxf } from '../pythonBridge.js';
import { dxfRateLimiter } from '../middleware/rateLimiter.js';
import { dxfRequestSchema } from '../schemas/dxfRequest.js';
import { batchRowSchema } from '../schemas/apiSchemas.js';
import { parseBatchCsv, RawBatchRow } from '../services/batchService.js';
import analyticsService from '../services/analyticsService.js';
import multer from 'multer';
import express from 'express';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

const largeBodyParser = express.json({ limit: '5mb' });

function getBaseUrl(req: Request, port: string | number): string {
    if (process.env.CLOUD_RUN_BASE_URL) return process.env.CLOUD_RUN_BASE_URL;
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${port}`;
    return `${protocol}://${host}`;
}

/**
 * POST /api/dxf
 * Gera arquivo DXF a partir de coordenadas e configurações.
 */
router.post('/api/dxf', largeBodyParser, dxfRateLimiter, async (req: Request, res: Response) => {
    const startTs = Date.now();
    try {
        const validation = dxfRequestSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Validação DXF falhou', { issues: validation.error.issues, ip: req.ip });
            return res.status(400).json({ error: 'Corpo da requisição inválido', details: validation.error.issues });
        }

        const { lat, lon, radius, mode, designer, numero_desenho, revisao, verificado_por, aprovado_por, aneel_prodist } = validation.data;
        const { polygon, layers, projection } = req.body;
        const resolvedMode = mode /* istanbul ignore next */ || 'circle';
        const cacheKey = createCacheKey({
            lat, lon, radius,
            mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : polygon ?? null,
            layers: layers ?? {}
        });

        const dxfDirectory = res.locals.dxfDirectory as string;
        const cachedFilename = getCachedFilename(cacheKey);
        if (cachedFilename) {
            const cachedFilePath = path.join(dxfDirectory, cachedFilename);
            if (fs.existsSync(cachedFilePath)) {
                const baseUrl = getBaseUrl(req, process.env.PORT || 3001);
                logger.info('DXF cache hit', { cacheKey, filename: cachedFilename, ip: req.ip });
                analyticsService.record({ timestamp: startTs, lat, lon, radius, mode: resolvedMode as 'circle' | 'polygon', success: true, durationMs: Date.now() - startTs, isBatch: false });
                return res.json({ status: 'success', message: 'DXF Gerado', url: `${baseUrl}/downloads/${cachedFilename}` });
            }
            deleteCachedFilename(cacheKey);
            logger.warn('Cache DXF: arquivo ausente', { cacheKey, filename: cachedFilename });
        } else {
            logger.info('DXF cache miss', { cacheKey, ip: req.ip });
        }

        if (!fs.existsSync(dxfDirectory)) {
            logger.error('Diretório DXF não existe', { dxfDirectory });
            return res.status(500).json({ error: 'Erro de configuração do servidor', details: 'Diretório de saída DXF indisponível' });
        }

        const baseUrl = getBaseUrl(req, process.env.PORT || 3001);
        const filename = `dxf_${Date.now()}.dxf`;
        const outputFile = path.join(dxfDirectory, filename);
        const downloadUrl = `${baseUrl}/downloads/${filename}`;

        logger.info('Enfileirando geração DXF', { lat, lon, radius, mode: resolvedMode, projection: projection || 'local', cacheKey, outputFile });

        const { taskId, alreadyCompleted } = await createDxfTask({
            lat, lon, radius,
            mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : JSON.stringify(polygon || []),
            layers: layers || {},
            projection: projection || 'local',
            outputFile, filename, cacheKey, downloadUrl,
            designer, numero_desenho, revisao, verificado_por, aprovado_por,
            aneelProdist: aneel_prodist,
        });

        if (!alreadyCompleted) {
            createJob(taskId);
        }

        analyticsService.record({ timestamp: startTs, lat, lon, radius, mode: resolvedMode as 'circle' | 'polygon', success: true, durationMs: Date.now() - startTs, isBatch: false });
        const responseStatus = alreadyCompleted ? 'success' : 'queued';
        return res.status(alreadyCompleted ? 200 : 202).json({
            status: responseStatus,
            jobId: taskId,
            ...(alreadyCompleted && { url: downloadUrl, message: 'DXF gerado imediatamente em modo de desenvolvimento' })
        });
    } catch (err: any) {
        logger.error('Erro na geração DXF', { error: err });
        analyticsService.record({
            timestamp: startTs,
            lat: req.body?.lat /* istanbul ignore next */ ?? 0,
            lon: req.body?.lon /* istanbul ignore next */ ?? 0,
            radius: req.body?.radius /* istanbul ignore next */ ?? 0,
            mode: 'circle',
            success: false,
            durationMs: Date.now() - startTs,
            isBatch: false,
            errorMessage: err.message,
        });
        return res.status(500).json({ error: 'Falha na geração', details: err.message });
    }
});

/**
 * POST /api/batch/dxf
 * Geração em lote de DXFs a partir de CSV.
 */
router.post('/api/batch/dxf', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Arquivo CSV obrigatório' });
        }

        const rows = await parseBatchCsv(req.file.buffer);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'CSV vazio ou inválido' });
        }

        const dxfDirectory = res.locals.dxfDirectory as string;
        const results: Array<{ name: string; status: string; jobId?: string | number; url?: string }> = [];
        const errors: Array<{ line: number; message: string; row: RawBatchRow }> = [];

        for (const entry of rows) {
            const validation = batchRowSchema.safeParse(entry.row);
            if (!validation.success) {
                errors.push({
                    line: entry.line,
                    message: validation.error.issues.map((issue) => issue.message).join(', '),
                    row: entry.row
                });
                continue;
            }

            const { name, lat, lon, radius, mode } = validation.data;
            const cacheKey = createCacheKey({ lat, lon, radius, mode, polygon: [], layers: {} });
            const cachedFilename = getCachedFilename(cacheKey);

            if (cachedFilename) {
                const cachedFilePath = path.join(dxfDirectory, cachedFilename);
                if (fs.existsSync(cachedFilePath)) {
                    const baseUrl = getBaseUrl(req, process.env.PORT || 3001);
                    results.push({ name, status: 'cached', url: `${baseUrl}/downloads/${cachedFilename}` });
                    continue;
                }
                deleteCachedFilename(cacheKey);
            }

            const safeName = name.toLowerCase().replace(/[^a-z0-9-_]+/g, '_').slice(0, 40) || /* istanbul ignore next */ 'batch';
            const filename = `dxf_${safeName}_${Date.now()}_${entry.line}.dxf`;
            const outputFile = path.join(dxfDirectory, filename);
            const baseUrl = getBaseUrl(req, process.env.PORT || 3001);
            const downloadUrl = `${baseUrl}/downloads/${filename}`;

            const { taskId } = await createDxfTask({ lat, lon, radius, mode, polygon: '[]', layers: {}, projection: 'local', outputFile, filename, cacheKey, downloadUrl });
            createJob(taskId);
            results.push({ name, status: 'queued', jobId: taskId });
        }

        if (results.length === 0) {
            return res.status(400).json({ error: 'Nenhuma linha válida encontrada', errors });
        }

        return res.status(200).json({ results, errors });
    } catch (err: any) {
        logger.error('Falha no upload em lote de DXF', { error: err });
        return res.status(500).json({ error: 'Falha no processamento em lote', details: err.message });
    }
});

export { getBaseUrl };
export default router;
