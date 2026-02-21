/**
 * sisRUA Unified Backend - Entry Point
 *
 * Responsabilidade: Bootstrap do servidor Express.
 * Toda a lógica de rotas está em server/routes/
 * Toda a lógica de serviços está em server/services/
 */
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import swaggerUi from 'swagger-ui-express';

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logger.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { specs } from './swagger.js';
import { startFirestoreMonitoring, stopFirestoreMonitoring } from './services/firestoreService.js';

// Rotas modularizadas
import healthRouter from './routes/health.js';
import jobsRouter from './routes/jobs.js';
import analysisRouter from './routes/analysis.js';
import dxfRouter from './routes/dxf.js';
import tasksRouter from './routes/tasks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const port = process.env.PORT || 3001;

// ─── Resolução de diretórios ────────────────────────────────────────────────

function resolveDxfDirectory(): string {
    const candidates = [
        path.resolve(__dirname, '../public/dxf'),
        path.resolve(__dirname, '../../../public/dxf'),
        '/app/public/dxf',
        path.resolve(process.cwd(), 'public/dxf')
    ];

    const existing = candidates.find((c) => fs.existsSync(c));
    if (existing) {
        logger.info('Diretório DXF encontrado', { path: existing });
        return existing;
    }

    const defaultDir = candidates[0];
    try {
        fs.mkdirSync(defaultDir, { recursive: true });
        logger.info('Diretório DXF criado', { path: defaultDir });
        return defaultDir;
    } catch (error: any) {
        logger.error('Falha ao criar diretório DXF', { path: defaultDir, error: error.message });
        return candidates[candidates.length - 1];
    }
}

function resolveFrontendDistDirectory(): string {
    const candidates = [
        path.resolve(__dirname, '../../dist'),
        path.resolve(__dirname, '../../../dist')
    ];
    const existing = candidates.find((c) => fs.existsSync(path.join(c, 'index.html')));
    return existing ?? candidates[candidates.length - 1];
}

const dxfDirectory = resolveDxfDirectory();
const frontendDistDirectory = resolveFrontendDistDirectory();

// ─── Configuração CORS ───────────────────────────────────────────────────────

const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:8080',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
        ];

        if (process.env.CLOUD_RUN_BASE_URL) {
            allowedOrigins.push(process.env.CLOUD_RUN_BASE_URL);
        }

        let isCloudRunOrigin = false;
        try {
            const originUrl = new URL(origin);
            isCloudRunOrigin = originUrl.hostname.endsWith('.run.app') ||
                originUrl.hostname.endsWith('.southamerica-east1.run.app');
        } catch {
            isCloudRunOrigin = false;
        }

        if (allowedOrigins.includes(origin) || isCloudRunOrigin) {
            logger.info('Requisição CORS permitida', { origin, isCloudRun: isCloudRunOrigin });
            callback(null, true);
        } else if (process.env.NODE_ENV === 'production') {
            logger.warn('Requisição CORS rejeitada em produção', { origin });
            callback(new Error('Não permitido pelo CORS'), false);
        } else {
            logger.info('Requisição CORS de origem não listada permitida em desenvolvimento', { origin });
            callback(null, true);
        }
    },
    credentials: true
};

// ─── Middlewares Globais ─────────────────────────────────────────────────────

app.set('trust proxy', true);
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(generalRateLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Injeta dxfDirectory via res.locals para rotas que precisam
app.use((req, res, next) => {
    res.locals.dxfDirectory = dxfDirectory;
    next();
});

// Middleware de log de requisições
app.use((req, _res, next) => {
    logger.info('Requisição recebida', { method: req.method, url: req.url, ip: req.ip });
    next();
});

// ─── Log de inicialização ────────────────────────────────────────────────────

logger.info('Servidor iniciando com configuração de ambiente', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    dockerEnv: process.env.DOCKER_ENV,
    hasGroqApiKey: !!process.env.GROQ_API_KEY,
    gcpProject: process.env.GCP_PROJECT || 'não configurado',
    cloudRunBaseUrl: process.env.CLOUD_RUN_BASE_URL || 'não configurado',
    dxfDirectory,
    frontendDistDirectory
});

// ─── Rotas ────────────────────────────────────────────────────────────────────

app.use(healthRouter);
app.use(jobsRouter);
app.use(analysisRouter);
app.use(dxfRouter);
app.use(tasksRouter);

// ─── Frontend estático ────────────────────────────────────────────────────────

if (fs.existsSync(path.join(frontendDistDirectory, 'index.html'))) {
    app.use(express.static(frontendDistDirectory));

    app.get('*', (req: Request, res: Response, next) => {
        if (
            req.path.startsWith('/api') ||
            req.path.startsWith('/downloads') ||
            req.path.startsWith('/api-docs') ||
            req.path === '/health'
        ) {
            return next();
        }
        return res.sendFile(path.join(frontendDistDirectory, 'index.html'));
    });
}

// ─── Tratador global de erros ────────────────────────────────────────────────

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Erro não tratado', { error: err.message, stack: err.stack, path: req.path, method: req.method });

    if (req.path.startsWith('/api')) {
        return res.status(err.status || 500).json({
            error: err.message || 'Erro interno do servidor',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }

    return res.status(err.status || 500).send('Erro Interno do Servidor');
});

// ─── Inicialização ────────────────────────────────────────────────────────────

app.listen(port, async () => {
    const baseUrl = process.env.CLOUD_RUN_BASE_URL || `http://localhost:${port}`;
    logger.info('Backend online', { service: 'sisRUA Unified Backend', version: '1.2.0', url: baseUrl, port });

    if (process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true') {
        try {
            await startFirestoreMonitoring();
            logger.info('Monitoramento Firestore iniciado');
        } catch (error) {
            logger.error('Falha ao iniciar monitoramento Firestore', { error });
        }
    } else {
        logger.info('Firestore desativado (modo de desenvolvimento)');
    }
});

// ─── Desligamento gracioso ────────────────────────────────────────────────────

process.on('SIGTERM', () => {
    logger.info('SIGTERM recebido, desligando graciosamente');
    stopFirestoreMonitoring();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT recebido, desligando graciosamente');
    stopFirestoreMonitoring();
    process.exit(0);
});
