import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import { getJob } from '../services/jobStatusService.js';

const router = Router();

/**
 * GET /api/jobs/:id
 * Consulta o status de um job de geração de DXF.
 */
router.get('/api/jobs/:id', async (req: Request, res: Response) => {
    try {
        const job = getJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job não encontrado' });
        }

        return res.json({
            id: job.id,
            status: job.status,
            progress: job.progress,
            result: job.result,
            error: job.error
        });
    } catch (err: any) {
        logger.error('Falha na consulta de status do job', { error: err });
        return res.status(500).json({ error: 'Falha ao consultar status do job', details: err.message });
    }
});

/**
 * GET /downloads/:filename
 * Serve arquivos DXF gerados com validação de segurança.
 */
router.get('/downloads/:filename', (req: Request, res: Response) => {
    const { filename } = req.params;

    // Segurança: apenas arquivos .dxf, sem path traversal
    if (!filename.endsWith('.dxf') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        logger.warn('Requisição de download inválida', { filename });
        return res.status(400).json({
            error: 'Nome de arquivo inválido',
            message: 'Apenas arquivos DXF são permitidos'
        });
    }

    const dxfDirectory = (res.locals.dxfDirectory as string) ?? /* istanbul ignore next */ path.resolve(process.cwd(), 'public/dxf');
    const filePath = path.join(dxfDirectory, filename);

    let stats;
    try {
        stats = fs.statSync(filePath);
    } catch (error: any) {
        logger.warn('Arquivo DXF não encontrado ou inacessível', { filename, error: error.message });
        return res.status(404).json({
            error: 'Arquivo não encontrado',
            message: 'O arquivo DXF solicitado pode ter expirado ou não existe',
            filename
        });
    }

    if (!stats.isFile()) {
        logger.error('Caminho de download não é um arquivo', { filePath });
        return res.status(400).json({
            error: 'Requisição inválida',
            message: 'O caminho solicitado não é um arquivo'
        });
    }

    logger.info('Servindo arquivo DXF', { filename, size: stats.size, age: Date.now() - stats.mtimeMs });

    res.sendFile(filePath, /* istanbul ignore next */ (err) => {
        if (err) {
            logger.error('Erro ao enviar arquivo DXF', { filename, error: err.message });
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Falha ao enviar arquivo',
                    message: 'Ocorreu um erro ao enviar o arquivo'
                });
            }
        }
    });
});

export default router;
