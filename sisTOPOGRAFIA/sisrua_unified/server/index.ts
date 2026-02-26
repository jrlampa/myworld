import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import multer from 'multer';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';
import { spawn } from 'child_process';

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { GeocodingService } from './services/geocodingService.js';
import { ElevationService } from './services/elevationService.js';
import { AnalysisService } from './services/analysisService.js';
import {
    createCacheKey,
    deleteCachedFilename,
    getCachedFilename,
    setCachedFilename
} from './services/cacheService.js';
import { createDxfTask } from './services/cloudTasksService.js';
import { createJob, getJob, updateJobStatus, completeJob, failJob } from './services/jobStatusService.js';
import { scheduleDxfDeletion } from './services/dxfCleanupService.js';
import { generateDxf } from './pythonBridge.js';
import { logger } from './utils/logger.js';
import { generalRateLimiter, dxfRateLimiter } from './middleware/rateLimiter.js';
import { verifyCloudTasksToken, webhookRateLimiter } from './middleware/auth.js';
import { dxfRequestSchema } from './schemas/dxfRequest.js';
import {
    searchSchema,
    elevationProfileSchema,
    analysisSchema,
    batchRowSchema
} from './schemas/apiSchemas.js';
import { parseBatchCsv, RawBatchRow } from './services/batchService.js';
import { specs } from './swagger.js';
import { startFirestoreMonitoring, stopFirestoreMonitoring, getFirestoreService } from './services/firestoreService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security constants
const MAX_ERROR_MESSAGE_LENGTH = 200;
const ALLOWED_PYTHON_COMMANDS = ['python3', 'python'];

const app: Express = express();
const port = process.env.PORT || 3001;

function resolveDxfDirectory(): string {
    const candidates = [
        path.resolve(__dirname, '../public/dxf'),
        path.resolve(__dirname, '../../../public/dxf')
    ];

    const existing = candidates.find((candidate) => fs.existsSync(candidate));
    if (existing) {
        return existing;
    }

    return candidates[candidates.length - 1];
}

function resolveFrontendDistDirectory(): string {
    const candidates = [
        path.resolve(__dirname, '../../dist'),
        path.resolve(__dirname, '../../../dist')
    ];

    const existing = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));
    if (existing) {
        return existing;
    }

    return candidates[candidates.length - 1];
}

const dxfDirectory = resolveDxfDirectory();
const frontendDistDirectory = resolveFrontendDistDirectory();

function getBaseUrl(req?: Request): string {
    if (process.env.CLOUD_RUN_BASE_URL) {
        return process.env.CLOUD_RUN_BASE_URL;
    }
    if (req) {
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
        const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${port}`;
        return `${protocol}://${host}`;
    }
    return `http://localhost:${port}`;
}
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

app.set('trust proxy', true);

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
        } catch (e) {
            isCloudRunOrigin = false;
        }
        if (allowedOrigins.indexOf(origin) !== -1 || isCloudRunOrigin) {
            callback(null, true);
        } else {
            if (process.env.NODE_ENV === 'production') {
                callback(new Error('Not allowed by CORS'), false);
            } else {
                callback(null, true);
            }
        }
    },
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(generalRateLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

const smallBodyParser = express.json({ limit: '100kb' });
const largeBodyParser = express.json({ limit: '5mb' });

app.get('/health', async (_req: Request, res: Response) => {
    try {
        const pythonCommand = process.env.PYTHON_COMMAND || 'python3';
        if (!ALLOWED_PYTHON_COMMANDS.includes(pythonCommand)) {
            return res.json({ status: 'degraded', python: 'unavailable' });
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
            version: '1.5.0',
            python: pythonAvailable ? 'available' : 'unavailable'
        });
    } catch (error) {
        res.json({ status: 'degraded' });
    }
});

app.use('/downloads', express.static(dxfDirectory));

// DXF Generation Endpoint
app.post('/api/dxf', largeBodyParser, dxfRateLimiter, async (req: Request, res: Response) => {
    try {
        const validation = dxfRequestSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: 'Invalid request', details: validation.error.issues });

        const { lat, lon, radius, mode, polygon, layers, projection } = validation.data;
        const resolvedMode = mode || 'circle';
        const cacheKey = createCacheKey({ lat, lon, radius, mode: resolvedMode, polygon, layers: layers ?? {} });

        const cachedFilename = getCachedFilename(cacheKey);
        if (cachedFilename && fs.existsSync(path.join(dxfDirectory, cachedFilename))) {
            return res.json({ status: 'success', url: `${getBaseUrl(req)}/downloads/${cachedFilename}` });
        }

        const filename = `dxf_${Date.now()}.dxf`;
        const outputFile = path.join(dxfDirectory, filename);
        const downloadUrl = `${getBaseUrl(req)}/downloads/${filename}`;

        const { taskId, alreadyCompleted } = await createDxfTask({
            lat, lon, radius, mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : JSON.stringify(polygon || []),
            layers: layers || {},
            projection: projection || 'local',
            outputFile, filename, cacheKey, downloadUrl
        });

        if (!alreadyCompleted) createJob(taskId);
        return res.status(alreadyCompleted ? 200 : 202).json({
            status: alreadyCompleted ? 'success' : 'queued',
            jobId: taskId,
            ...(alreadyCompleted && { url: downloadUrl })
        });
    } catch (err: any) {
        return res.status(500).json({ error: 'Generation failed', details: err.message });
    }
});

// Pad Analysis (Cut/Fill) Endpoint
app.post('/api/analyze-pad', largeBodyParser, async (req: Request, res: Response) => {
    try {
        const { polygon, targetZ } = req.body;
        if (!polygon || targetZ === undefined) return res.status(400).json({ error: 'polygon and targetZ are required' });

        logger.info('Pad Analysis requested', { targetZ, polygonPoints: polygon.length });
        const result = await generateDxf({
            polygon: JSON.stringify(polygon),
            targetZ,
            pythonMode: 'analyze_pad'
        });
        return res.json(JSON.parse(result));
    } catch (err: any) {
        return res.status(500).json({ error: 'Analysis failed', details: err.message });
    }
});

// Coordinate Search
app.post('/api/search', smallBodyParser, async (req: Request, res: Response) => {
    try {
        const validation = searchSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: 'Invalid request' });
        const location = await GeocodingService.resolveLocation(validation.data.query);
        return location ? res.json(location) : res.status(404).json({ error: 'Not found' });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// Elevation Profile
app.post('/api/elevation/profile', async (req: Request, res: Response) => {
    try {
        const validation = elevationProfileSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: 'Invalid request' });
        const { start, end, steps } = validation.data;
        const profile = await ElevationService.getElevationProfile(start, end, steps);
        return res.json({ profile });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// AI Analyze
app.post('/api/analyze', smallBodyParser, async (req: Request, res: Response) => {
    try {
        const validation = analysisSchema.safeParse(req.body);
        if (!validation.success) return res.status(400).json({ error: 'Invalid request' });
        const { stats, locationName } = validation.data;
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return res.status(503).json({ error: 'GROQ_API_KEY not configured' });
        const result = await AnalysisService.analyzeArea(stats, locationName || 'Área Selecionada', apiKey);
        return res.json(result);
    } catch (error: any) {
        return res.status(500).json({ error: 'Analysis failed' });
    }
});

// Job Status
app.get('/api/jobs/:id', async (req: Request, res: Response) => {
    try {
        const job = getJob(req.params.id);
        return job ? res.json(job) : res.status(404).json({ error: 'Job not found' });
    } catch (err: any) {
        return res.status(500).json({ error: 'Failed to retrieve job status' });
    }
});

app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
});
