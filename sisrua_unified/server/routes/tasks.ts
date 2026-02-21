import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import { createJob, getJob, updateJobStatus, completeJob, failJob } from '../services/jobStatusService.js';
import { setCachedFilename } from '../services/cacheService.js';
import { scheduleDxfDeletion } from '../services/dxfCleanupService.js';
import { generateDxf } from '../pythonBridge.js';
import { verifyCloudTasksToken, webhookRateLimiter } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/tasks/process-dxf
 * Webhook do Cloud Tasks para processar geração de DXF.
 * Protegido por validação de token OIDC e rate limiting.
 */
router.post('/api/tasks/process-dxf',
    webhookRateLimiter,
    verifyCloudTasksToken,
    async (req: Request, res: Response) => {
        try {
            logger.info('Webhook DXF: requisição autenticada recebida', { taskId: req.body.taskId });

            const {
                taskId, lat, lon, radius, mode,
                polygon, layers, projection, outputFile, filename, cacheKey, downloadUrl
            } = req.body;

            if (!taskId) {
                return res.status(400).json({ error: 'Task ID obrigatório' });
            }

            if (!getJob(taskId)) {
                createJob(taskId);
                logger.info('Job criado no webhook (não pré-criado)', { taskId });
            }

            updateJobStatus(taskId, 'processing', 10);
            logger.info('Processando tarefa de geração DXF', { taskId, lat, lon, radius, mode, cacheKey, outputFile });

            try {
                const outputDir = path.dirname(outputFile);
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                    logger.info('Diretório de saída DXF criado no webhook', { outputDir });
                }

                await generateDxf({ lat, lon, radius, mode, polygon, layers, projection, outputFile });

                if (!fs.existsSync(outputFile)) {
                    throw new Error(`Arquivo DXF não criado no caminho esperado: ${outputFile}`);
                }

                setCachedFilename(cacheKey, filename);
                scheduleDxfDeletion(outputFile);
                completeJob(taskId, { url: downloadUrl, filename });

                logger.info('Geração DXF concluída', { taskId, filename, cacheKey, outputFile });

                return res.status(200).json({ status: 'success', taskId, url: downloadUrl, filename });
            } catch (error: any) {
                logger.error('Falha na geração DXF no webhook', { taskId, error: error.message, stack: error.stack });
                failJob(taskId, error.message);
                return res.status(500).json({ status: 'failed', taskId, error: error.message });
            }
        } catch (error: any) {
            logger.error('Erro no webhook de tarefa', { error: error.message, stack: error.stack });
            return res.status(500).json({ error: 'Falha no processamento da tarefa', details: error.message });
        }
    }
);

export default router;
