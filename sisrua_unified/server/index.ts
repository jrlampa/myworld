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
import { dxfRequestSchema } from './schemas/dxfRequest.js';
import { parseBatchCsv, RawBatchRow } from './services/batchService.js';
import { specs } from './swagger.js';

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
        
        // CRITICAL FIX: Allow Cloud Run service to call itself
        // Cloud Run URLs follow pattern: https://{service}-{hash}.{region}.run.app
        // Security: Parse URL and check hostname ends with .run.app
        let isCloudRunOrigin = false;
        try {
            const originUrl = new URL(origin);
            isCloudRunOrigin = originUrl.hostname.endsWith('.run.app') || 
                             originUrl.hostname.endsWith('.southamerica-east1.run.app');
        } catch (e) {
            // Invalid URL, not a Cloud Run origin
            isCloudRunOrigin = false;
        }
        
        // Check if origin is allowed
        if (allowedOrigins.indexOf(origin) !== -1 || isCloudRunOrigin) {
            logger.info('CORS request allowed', { origin, isCloudRun: isCloudRunOrigin });
            callback(null, true);
        } else {
            // In development mode, allow with warning; in production, reject
            if (process.env.NODE_ENV === 'production') {
                logger.warn('CORS request rejected in production', { origin, allowedOrigins });
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

// DEBUG: Log environment variables on startup
logger.info('Server starting with environment configuration', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    dockerEnv: process.env.DOCKER_ENV,
    hasGroqApiKey: !!process.env.GROQ_API_KEY,
    groqKeyLength: process.env.GROQ_API_KEY?.length || 0,
    groqKeyPrefix: process.env.GROQ_API_KEY?.substring(0, 7) || 'NOT_SET',
    gcpProject: process.env.GCP_PROJECT || 'not-set',
    cloudRunBaseUrl: process.env.CLOUD_RUN_BASE_URL || 'not-set'
});

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
app.get('/health', async (_req: Request, res: Response) => {
    try {
        const pythonCommand = process.env.PYTHON_COMMAND || 'python3';
        
        // Security: Validate Python command
        if (!ALLOWED_PYTHON_COMMANDS.includes(pythonCommand)) {
            logger.error('Invalid PYTHON_COMMAND', { pythonCommand });
            return res.json({
                status: 'degraded',
                service: 'sisRUA Unified Backend',
                version: '1.2.0',
                python: 'unavailable',
                error: 'Invalid Python command configuration'
            });
        }
        
        // Quick Python availability check (non-blocking)
        const pythonAvailable = await new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
                resolve(false);
            }, 2000); // 2 second timeout
            
            const proc = spawn(pythonCommand, ['--version']);
            
            proc.on('close', (code) => {
                clearTimeout(timeout);
                resolve(code === 0);
            });
            
            proc.on('error', () => {
                clearTimeout(timeout);
                resolve(false);
            });
        });

        res.json({
            status: 'online',
            service: 'sisRUA Unified Backend',
            version: '1.2.0',
            python: pythonAvailable ? 'available' : 'unavailable',
            environment: process.env.NODE_ENV || 'development',
            dockerized: process.env.DOCKER_ENV === 'true',
            // Include GROQ API key status for debugging
            groqApiKey: {
                configured: !!process.env.GROQ_API_KEY,
                length: process.env.GROQ_API_KEY?.length || 0,
                prefix: process.env.GROQ_API_KEY?.substring(0, 7) || 'NOT_SET'
            }
        });
    } catch (error) {
        // If health check fails, still return 200 but with degraded status
        res.json({
            status: 'degraded',
            service: 'sisRUA Unified Backend',
            version: '1.2.0',
            error: 'Health check encountered an error'
        });
    }
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
        
        // Better validation for coordinate objects
        if (!start || typeof start !== 'object' || !('lat' in start) || !('lng' in start)) {
            logger.warn('Invalid start coordinate in elevation request', { start, body: req.body });
            return res.status(400).json({ 
                error: 'Invalid start coordinate',
                details: 'Start coordinate must be an object with lat and lng properties'
            });
        }
        
        if (!end || typeof end !== 'object' || !('lat' in end) || !('lng' in end)) {
            logger.warn('Invalid end coordinate in elevation request', { end, body: req.body });
            return res.status(400).json({ 
                error: 'Invalid end coordinate',
                details: 'End coordinate must be an object with lat and lng properties'
            });
        }

        logger.info('Fetching elevation profile', { start, end, steps });
        const profile = await ElevationService.getElevationProfile(start, end, steps);
        return res.json({ profile });
    } catch (error: any) {
        logger.error('Elevation profile error', { 
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        return res.status(500).json({ error: error.message });
    }
});

// AI Analyze Endpoint (Delegating to AnalysisService)
app.post('/api/analyze', async (req: Request, res: Response) => {
    try {
        const { stats, locationName } = req.body;
        const apiKey = process.env.GROQ_API_KEY || '';
        
        // DEBUG: Log GROQ_API_KEY status at request time
        logger.info('GROQ API analysis requested', {
            locationName,
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey.length,
            apiKeyPrefix: apiKey.substring(0, 7) || 'EMPTY',
            timestamp: new Date().toISOString()
        });
        
        // Validate request body
        if (!stats) {
            logger.warn('Analysis requested without stats');
            return res.status(400).json({ 
                error: 'Stats required',
                details: 'Request body must include stats object'
            });
        }
        
        if (!apiKey) {
            logger.warn('Analysis requested but GROQ_API_KEY not configured');
            return res.status(503).json({ 
                error: 'GROQ_API_KEY not configured',
                message: 'AI analysis is unavailable. Please configure GROQ_API_KEY in the .env file to enable intelligent analysis features.',
                analysis: '**Análise AI Indisponível**\n\nPara habilitar análises inteligentes com IA, configure a variável `GROQ_API_KEY` no arquivo `.env`.\n\nObtenha sua chave gratuita em: https://console.groq.com/keys'
            });
        }

        logger.info('Processing AI analysis request', { locationName, hasStats: !!stats });
        const result = await AnalysisService.analyzeArea(stats, locationName, apiKey);
        logger.info('AI analysis completed successfully', { locationName });
        return res.json(result);
    } catch (error: any) {
        logger.error('Analysis error', { 
            error: error.message,
            stack: error.stack,
            body: req.body,
            errorType: error.constructor.name,
            // Check for common Groq API errors
            isRateLimitError: error.message?.includes('rate limit') || error.message?.includes('429'),
            isAuthError: error.message?.includes('401') || error.message?.includes('unauthorized') || error.message?.includes('invalid api key'),
            isNetworkError: error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')
        });
        
        // Sanitize error message to prevent injection
        const sanitizedMessage = String(error.message || 'Unknown error').slice(0, MAX_ERROR_MESSAGE_LENGTH);
        
        // Provide more specific error messages
        let userMessage = '**Erro na Análise AI**\n\nNão foi possível processar a análise. Por favor, tente novamente.';
        
        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
            userMessage = '**Limite de Taxa Excedido**\n\nMuitas requisições à API Groq. Por favor, aguarde alguns momentos e tente novamente.';
        } else if (error.message?.includes('401') || error.message?.includes('unauthorized') || error.message?.includes('invalid api key')) {
            userMessage = '**Erro de Autenticação**\n\nA chave GROQ_API_KEY parece estar inválida. Verifique a configuração no Cloud Run.';
        } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
            userMessage = '**Erro de Conexão**\n\nNão foi possível conectar à API Groq. Verifique a conectividade de rede.';
        }
        
        return res.status(500).json({ 
            error: 'Analysis failed',
            details: sanitizedMessage,
            analysis: userMessage
        });
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
