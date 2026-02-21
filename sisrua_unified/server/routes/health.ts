import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import { getFirestoreService } from '../services/firestoreService.js';

const router = Router();

const ALLOWED_PYTHON_COMMANDS = ['python3', 'python'];

/**
 * GET /health
 * Verifica disponibilidade do serviço e do motor Python.
 */
router.get('/health', async (_req: Request, res: Response) => {
    try {
        const pythonCommand = process.env.PYTHON_COMMAND || 'python3';

        if (!ALLOWED_PYTHON_COMMANDS.includes(pythonCommand)) {
            logger.error('Comando PYTHON_COMMAND inválido', { pythonCommand });
            return res.json({
                status: 'degraded',
                service: 'sisRUA Unified Backend',
                version: '1.2.0',
                python: 'unavailable',
                error: 'Configuração inválida do comando Python'
            });
        }

        const pythonAvailable = await new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => resolve(false), 2000);
            const proc = spawn(pythonCommand, ['--version']);
            proc.on('close', (code) => { clearTimeout(timeout); resolve(code === 0); });
            proc.on('error', () => { clearTimeout(timeout); resolve(false); });
        });

        res.json({
            status: 'online',
            service: 'sisRUA Unified Backend',
            version: '1.2.0',
            python: pythonAvailable ? 'available' : 'unavailable',
            environment: process.env.NODE_ENV || 'development',
            dockerized: process.env.DOCKER_ENV === 'true',
            groqApiKey: { configured: !!process.env.GROQ_API_KEY }
        });
    } catch (_error) {
        res.json({
            status: 'degraded',
            service: 'sisRUA Unified Backend',
            version: '1.2.0',
            error: 'Erro ao verificar saúde do serviço'
        });
    }
});

/**
 * GET /api/firestore/status
 * Status do Firestore e circuit breaker.
 */
router.get('/api/firestore/status', async (_req: Request, res: Response) => {
    try {
        const useFirestore = process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true';

        if (!useFirestore) {
            return res.json({
                enabled: false,
                mode: 'memory',
                message: 'Firestore desativado (modo de desenvolvimento)'
            });
        }

        const firestoreService = getFirestoreService();
        const circuitBreaker = firestoreService.getCircuitBreakerStatus();
        const quotaUsage = await firestoreService.getCurrentUsage();

        const quotaPercentages = {
            reads: (quotaUsage.reads / 50000 * 100).toFixed(2),
            writes: (quotaUsage.writes / 20000 * 100).toFixed(2),
            deletes: (quotaUsage.deletes / 20000 * 100).toFixed(2),
            storage: (quotaUsage.storageBytes / (1024 * 1024 * 1024) * 100).toFixed(2)
        };

        res.json({
            enabled: true,
            mode: 'firestore',
            circuitBreaker: {
                status: circuitBreaker.isOpen ? 'OPEN' : 'CLOSED',
                operation: circuitBreaker.operation || 'none',
                message: circuitBreaker.isOpen
                    ? `Circuit breaker aberto para ${circuitBreaker.operation} (${circuitBreaker.usage}/${circuitBreaker.limit})`
                    : 'Todas as operações permitidas'
            },
            quotas: {
                date: quotaUsage.date,
                reads: { current: quotaUsage.reads, limit: 50000, percentage: `${quotaPercentages.reads}%`, available: 50000 - quotaUsage.reads },
                writes: { current: quotaUsage.writes, limit: 20000, percentage: `${quotaPercentages.writes}%`, available: 20000 - quotaUsage.writes },
                deletes: { current: quotaUsage.deletes, limit: 20000, percentage: `${quotaPercentages.deletes}%`, available: 20000 - quotaUsage.deletes },
                storage: { current: `${(quotaUsage.storageBytes / 1024 / 1024).toFixed(2)} MB`, limit: '1024 MB', percentage: `${quotaPercentages.storage}%`, bytes: quotaUsage.storageBytes }
            },
            lastUpdated: quotaUsage.lastUpdated
        });
    } catch (error: any) {
        logger.error('Falha na verificação do Firestore', { error });
        res.status(500).json({
            enabled: true,
            error: error.message,
            message: 'Falha ao recuperar status do Firestore'
        });
    }
});

export default router;
