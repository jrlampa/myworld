import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';
import multer from 'multer';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';

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
import { dxfRequestSchema } from './schemas/dxfRequest.js';
import { parseBatchCsv, RawBatchRow } from './services/batchService.js';
import { specs } from './swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

/**
 * Get the base URL for the application
 * Uses environment variable if available, otherwise derives from request
 */
function getBaseUrl(req?: Request): string {
    // 1. Check for Cloud Run base URL (production)
    if (process.env.CLOUD_RUN_BASE_URL) {
        return process.env.CLOUD_RUN_BASE_URL;
    }
    
    // 2. Derive from request if available
    if (req) {
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
        const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${port}`;
        return `${protocol}://${host}`;
    }
    
    // 3. Fallback to localhost (development)
    return `http://localhost:${port}`;
}
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

const batchRowSchema = z.object({
    name: z.string().min(1),
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(10).max(5000),
    mode: z.enum(['circle', 'polygon', 'bbox'])
});

// Configuração
app.set('trust proxy', true);

// CORS Configuration - Allow requests from development and production origins
const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        
        // List of allowed origins
        const allowedOrigins = [
            'http://localhost:3000',  // Vite dev server
            'http://localhost:8080',  // Production server
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
        ];
        
        // Add Cloud Run URL if configured
        if (process.env.CLOUD_RUN_BASE_URL) {
            allowedOrigins.push(process.env.CLOUD_RUN_BASE_URL);
        }
        
        // Check if origin is allowed
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // In development mode, allow with warning; in production, reject
            if (process.env.NODE_ENV === 'production') {
                logger.warn('CORS request rejected in production', { origin });
                callback(new Error('Not allowed by CORS'), false);
            } else {
                logger.info('CORS request from unlisted origin allowed in development', { origin });
                callback(null, true);
            }
        }
    },
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(generalRateLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Logging Middleware
app.use((req, _res, next) => {
    logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip
    });
    next();
});

// Health Check
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'online',
        service: 'sisRUA Unified Backend',
        version: '1.2.0'
    });
});

// Serve generated files
app.use('/downloads', express.static(dxfDirectory));

// Cloud Tasks Webhook - Process DXF Generation
app.post('/api/tasks/process-dxf', async (req: Request, res: Response) => {
    try {
        // In production, verify OIDC token here
        // For now, we'll accept requests but log them
        const authHeader = req.headers.authorization;
        logger.info('DXF task webhook called', {
            hasAuth: !!authHeader,
            taskId: req.body.taskId
        });

        const {
            taskId,
            lat,
            lon,
            radius,
            mode,
            polygon,
            layers,
            projection,
            outputFile,
            filename,
            cacheKey,
            downloadUrl
        } = req.body;

        if (!taskId) {
            return res.status(400).json({ error: 'Task ID is required' });
        }

        // Update job status to processing
        updateJobStatus(taskId, 'processing', 10);

        logger.info('Processing DXF generation task', {
            taskId,
            lat,
            lon,
            radius,
            mode,
            cacheKey
        });

        try {
            // Generate DXF using Python bridge
            await generateDxf({
                lat,
                lon,
                radius,
                mode,
                polygon,
                layers,
                projection,
                outputFile
            });

            // Cache the filename
            setCachedFilename(cacheKey, filename);

            // Schedule DXF file for deletion after 10 minutes
            scheduleDxfDeletion(outputFile);

            // Mark job as completed
            completeJob(taskId, {
                url: downloadUrl,
                filename
            });

            logger.info('DXF generation completed', {
                taskId,
                filename,
                cacheKey
            });

            return res.status(200).json({
                status: 'success',
                taskId,
                url: downloadUrl,
                filename
            });

        } catch (error: any) {
            logger.error('DXF generation failed', {
                taskId,
                error: error.message,
                stack: error.stack
            });

            failJob(taskId, error.message);

            return res.status(500).json({
                status: 'failed',
                taskId,
                error: error.message
            });
        }

    } catch (error: any) {
        logger.error('Task webhook error', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({
            error: 'Task processing failed',
            details: error.message
        });
    }
});

// Batch DXF Generation Endpoint
app.post('/api/batch/dxf', upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'CSV file is required' });
        }

        const rows = await parseBatchCsv(req.file.buffer);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'CSV is empty or invalid' });
        }

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
            const cacheKey = createCacheKey({
                lat,
                lon,
                radius,
                mode,
                polygon: [],
                layers: {}
            });

            const cachedFilename = getCachedFilename(cacheKey);
            if (cachedFilename) {
                const cachedFilePath = path.join(dxfDirectory, cachedFilename);
                if (fs.existsSync(cachedFilePath)) {
                    const baseUrl = getBaseUrl(req);
                    const cachedUrl = `${baseUrl}/downloads/${cachedFilename}`;
                    results.push({
                        name,
                        status: 'cached',
                        url: cachedUrl
                    });
                    continue;
                }

                deleteCachedFilename(cacheKey);
            }

            const safeName = name.toLowerCase().replace(/[^a-z0-9-_]+/g, '_').slice(0, 40) || 'batch';
            const filename = `dxf_${safeName}_${Date.now()}_${entry.line}.dxf`;
            const outputFile = path.join(dxfDirectory, filename);
            const baseUrl = getBaseUrl(req);
            const downloadUrl = `${baseUrl}/downloads/${filename}`;

            const { taskId } = await createDxfTask({
                lat,
                lon,
                radius,
                mode,
                polygon: '[]',
                layers: {},
                projection: 'local',
                outputFile,
                filename,
                cacheKey,
                downloadUrl
            });

            // Create job for status tracking
            createJob(taskId);

            results.push({
                name,
                status: 'queued',
                jobId: taskId
            });
        }

        if (results.length === 0) {
            return res.status(400).json({ error: 'No valid rows found', errors });
        }

        return res.status(200).json({ results, errors });
    } catch (err: any) {
        logger.error('Batch DXF upload failed', { error: err });
        return res.status(500).json({ error: 'Batch processing failed', details: err.message });
    }
});

// DXF Generation Endpoint (POST for large polygons)
app.post('/api/dxf', dxfRateLimiter, async (req: Request, res: Response) => {
    try {
        const validation = dxfRequestSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('DXF validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({ error: 'Invalid request body', details: validation.error.issues });
        }

        const { lat, lon, radius, mode } = validation.data;
        const { polygon, layers, projection } = req.body;
        const resolvedMode = mode || 'circle';
        const cacheKey = createCacheKey({
            lat,
            lon,
            radius,
            mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : polygon ?? null,
            layers: layers ?? {}
        });

        const cachedFilename = getCachedFilename(cacheKey);
        if (cachedFilename) {
            const cachedFilePath = path.join(dxfDirectory, cachedFilename);
            if (fs.existsSync(cachedFilePath)) {
                const baseUrl = getBaseUrl(req);
                const cachedUrl = `${baseUrl}/downloads/${cachedFilename}`;
                logger.info('DXF cache hit', {
                    cacheKey,
                    filename: cachedFilename,
                    ip: req.ip
                });
                return res.json({
                    status: 'success',
                    message: 'DXF Generated',
                    url: cachedUrl
                });
            }

            deleteCachedFilename(cacheKey);
            logger.warn('DXF cache entry missing file', {
                cacheKey,
                filename: cachedFilename,
                ip: req.ip
            });
        } else {
            logger.info('DXF cache miss', {
                cacheKey,
                ip: req.ip
            });
        }

        const baseUrl = getBaseUrl(req);
        const filename = `dxf_${Date.now()}.dxf`;
        const outputFile = path.join(dxfDirectory, filename);
        const downloadUrl = `${baseUrl}/downloads/${filename}`;

        logger.info('Queueing DXF generation', {
            lat,
            lon,
            radius,
            mode: resolvedMode,
            projection: projection || 'local',
            cacheKey
        });

        const { taskId, alreadyCompleted } = await createDxfTask({
            lat,
            lon,
            radius,
            mode: resolvedMode,
            polygon: typeof polygon === 'string' ? polygon : JSON.stringify(polygon || []),
            layers: layers || {},
            projection: projection || 'local',
            outputFile,
            filename,
            cacheKey,
            downloadUrl
        });

        // Create job for status tracking (unless it's already completed in dev mode)
        // In dev mode, createJob is called inside createDxfTask, so we don't call it again
        if (!alreadyCompleted) {
            createJob(taskId);
        }
        
        const responseStatus = alreadyCompleted ? 'success' : 'queued';
        return res.status(alreadyCompleted ? 200 : 202).json({
            status: responseStatus,
            jobId: taskId,
            ...(alreadyCompleted && { 
                url: downloadUrl,
                message: 'DXF generated immediately in development mode' 
            })
        });

    } catch (err: any) {
        logger.error('DXF generation error', { error: err });
        return res.status(500).json({ error: 'Generation failed', details: err.message });
    }
});

// Job Status Endpoint
app.get('/api/jobs/:id', async (req: Request, res: Response) => {
    try {
        const job = getJob(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        return res.json({
            id: job.id,
            status: job.status,
            progress: job.progress,
            result: job.result,
            error: job.error
        });
    } catch (err: any) {
        logger.error('Job status lookup failed', { error: err });
        return res.status(500).json({ error: 'Failed to retrieve job status', details: err.message });
    }
});

// Coordinate Search Endpoint (Using GeocodingService)
app.post('/api/search', async (req: Request, res: Response) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });

        const location = await GeocodingService.resolveLocation(query);

        if (location) {
            return res.json(location);
        } else {
            return res.status(404).json({ error: 'Location not found' });
        }
    } catch (error: any) {
        logger.error('Search error', { error });
        return res.status(500).json({ error: error.message });
    }
});

// Elevation Profile Endpoint (Delegating to ElevationService)
app.post('/api/elevation/profile', async (req: Request, res: Response) => {
    try {
        const { start, end, steps = 25 } = req.body;
        if (!start || !end) return res.status(400).json({ error: 'Start and end coordinates required' });

        const profile = await ElevationService.getElevationProfile(start, end, steps);
        return res.json({ profile });
    } catch (error: any) {
        logger.error('Elevation profile error', { error });
        return res.status(500).json({ error: error.message });
    }
});

// AI Analyze Endpoint (Delegating to AnalysisService)
app.post('/api/analyze', async (req: Request, res: Response) => {
    try {
        const { stats, locationName } = req.body;
        const apiKey = process.env.GROQ_API_KEY || '';
        
        if (!apiKey) {
            logger.warn('Analysis requested but GROQ_API_KEY not configured');
            return res.status(503).json({ 
                error: 'GROQ_API_KEY not configured',
                message: 'AI analysis is unavailable. Please configure GROQ_API_KEY in the .env file to enable intelligent analysis features.',
                analysis: '**Análise AI Indisponível**\n\nPara habilitar análises inteligentes com IA, configure a variável `GROQ_API_KEY` no arquivo `.env`.\n\nObtenha sua chave gratuita em: https://console.groq.com/keys'
            });
        }

        const result = await AnalysisService.analyzeArea(stats, locationName, apiKey);
        return res.json(result);
    } catch (error: any) {
        logger.error('Analysis error', { error });
        return res.status(500).json({ error: error.message });
    }
});

if (fs.existsSync(path.join(frontendDistDirectory, 'index.html'))) {
    app.use(express.static(frontendDistDirectory));

    app.get('*', (req: Request, res: Response, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/downloads') || req.path.startsWith('/api-docs') || req.path === '/health') {
            return next();
        }

        return res.sendFile(path.join(frontendDistDirectory, 'index.html'));
    });
}

// Global error handler - must be after all routes
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    
    // Ensure we always send JSON for API endpoints
    if (req.path.startsWith('/api')) {
        return res.status(err.status || 500).json({
            error: err.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
    
    // For non-API routes, send error page if available
    return res.status(err.status || 500).send('Internal Server Error');
});

app.listen(port, () => {
    const baseUrl = getBaseUrl();
    logger.info('Backend online', {
        service: 'sisRUA Unified Backend',
        version: '1.2.0',
        url: baseUrl,
        port: port
    });
});
