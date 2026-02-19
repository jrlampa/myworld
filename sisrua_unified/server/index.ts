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
        path.resolve(__dirname, '../../../public/dxf'),
        '/app/public/dxf', // Docker/Cloud Run path
        path.resolve(process.cwd(), 'public/dxf') // Working directory fallback
    ];

    const existing = candidates.find((candidate) => fs.existsSync(candidate));
    if (existing) {
        logger.info('DXF directory found', { path: existing });
        return existing;
    }

    // Create the first candidate directory if none exist
    const defaultDir = candidates[0];
    try {
        fs.mkdirSync(defaultDir, { recursive: true });
        logger.info('DXF directory created', { path: defaultDir });
        return defaultDir;
    } catch (error: any) {
        logger.error('Failed to create DXF directory', { 
            path: defaultDir, 
            error: error.message 
        });
        // Return the last candidate as fallback
        return candidates[candidates.length - 1];
    }
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

// Batch row schema is now imported from apiSchemas.ts
// (removed local duplicate definition)

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
// Default body parser with reasonable 1MB limit for most endpoints
// This prevents large payload attacks on endpoints that don't need big requests
app.use(express.json({ limit: '1mb' }));
app.use(generalRateLimiter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Helper middleware for endpoints that need smaller body size limits
const smallBodyParser = express.json({ limit: '100kb' });

// Helper middleware for endpoints that need larger body size limits (used sparingly)
const largeBodyParser = express.json({ limit: '5mb' });

// DEBUG: Log environment variables on startup
logger.info('Server starting with environment configuration', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    dockerEnv: process.env.DOCKER_ENV,
    hasGroqApiKey: !!process.env.GROQ_API_KEY,
    // Removed groqKeyLength and groqKeyPrefix for security
    gcpProject: process.env.GCP_PROJECT || 'not-set',
    cloudRunBaseUrl: process.env.CLOUD_RUN_BASE_URL || 'not-set',
    dxfDirectory,
    frontendDistDirectory
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
                configured: !!process.env.GROQ_API_KEY
                // Removed 'prefix' and 'length' fields for security
                // API key details should not be exposed in public endpoints
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

// Firestore Status and Circuit Breaker Endpoint
app.get('/api/firestore/status', async (_req: Request, res: Response) => {
    try {
        const useFirestore = process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true';
        
        if (!useFirestore) {
            return res.json({
                enabled: false,
                mode: 'memory',
                message: 'Firestore is disabled (development mode)'
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
                    ? `Circuit breaker opened for ${circuitBreaker.operation} (${circuitBreaker.usage}/${circuitBreaker.limit})`
                    : 'All operations allowed'
            },
            quotas: {
                date: quotaUsage.date,
                reads: {
                    current: quotaUsage.reads,
                    limit: 50000,
                    percentage: `${quotaPercentages.reads}%`,
                    available: 50000 - quotaUsage.reads
                },
                writes: {
                    current: quotaUsage.writes,
                    limit: 20000,
                    percentage: `${quotaPercentages.writes}%`,
                    available: 20000 - quotaUsage.writes
                },
                deletes: {
                    current: quotaUsage.deletes,
                    limit: 20000,
                    percentage: `${quotaPercentages.deletes}%`,
                    available: 20000 - quotaUsage.deletes
                },
                storage: {
                    current: `${(quotaUsage.storageBytes / 1024 / 1024).toFixed(2)} MB`,
                    limit: '1024 MB',
                    percentage: `${quotaPercentages.storage}%`,
                    bytes: quotaUsage.storageBytes
                }
            },
            lastUpdated: quotaUsage.lastUpdated
        });
    } catch (error: any) {
        logger.error('Firestore status check failed', { error });
        res.status(500).json({
            enabled: true,
            error: error.message,
            message: 'Failed to retrieve Firestore status'
        });
    }
});

// Serve generated DXF files with explicit error handling
app.get('/downloads/:filename', (req: Request, res: Response) => {
    const filename = req.params.filename;
    
    // Security: Only allow DXF files and prevent directory traversal
    if (!filename.endsWith('.dxf') || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        logger.warn('Invalid download request', { filename });
        return res.status(400).json({ 
            error: 'Invalid filename',
            message: 'Only DXF files are allowed'
        });
    }
    
    const filePath = path.join(dxfDirectory, filename);
    
    // Check if file exists and get stats in one operation to avoid race conditions
    let stats;
    try {
        stats = fs.statSync(filePath);
    } catch (error: any) {
        // File doesn't exist or cannot be accessed
        logger.warn('DXF file not found or inaccessible', { 
            filename,
            error: error.message
        });
        return res.status(404).json({ 
            error: 'File not found',
            message: 'The requested DXF file may have expired or does not exist',
            filename
        });
    }
    
    // Check if path is actually a file (not a directory)
    if (!stats.isFile()) {
        logger.error('Download path is not a file', { filePath });
        return res.status(400).json({ 
            error: 'Invalid request',
            message: 'The requested path is not a file'
        });
    }
    
    // Serve the file
    logger.info('Serving DXF file', { 
        filename, 
        size: stats.size,
        age: Date.now() - stats.mtimeMs
    });
    
    res.sendFile(filePath, (err) => {
        if (err) {
            logger.error('Error sending DXF file', { 
                filename, 
                error: err.message 
            });
            // Only send response if headers haven't been sent
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Failed to send file',
                    message: 'An error occurred while sending the file'
                });
            }
        }
    });
});

// Cloud Tasks Webhook - Process DXF Generation
// Protected by OIDC token validation and rate limiting
app.post('/api/tasks/process-dxf', 
    webhookRateLimiter,
    verifyCloudTasksToken,
    async (req: Request, res: Response) => {
    try {
        // OIDC token has been verified by middleware
        // Request is authenticated and authorized
        logger.info('DXF task webhook processing authenticated request', {
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
// Uses larger body limit (5mb) to support complex polygon geometries
app.post('/api/dxf', largeBodyParser, dxfRateLimiter, async (req: Request, res: Response) => {
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
// Uses smaller body limit (100kb) - only needs a query string
app.post('/api/search', smallBodyParser, async (req: Request, res: Response) => {
    try {
        // Validate request with Zod schema
        const validation = searchSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Search validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({ 
                error: 'Invalid request',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { query } = validation.data;
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
        // Validate request with Zod schema
        const validation = elevationProfileSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Elevation profile validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({ 
                error: 'Invalid request',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { start, end, steps } = validation.data;
        logger.info('Fetching elevation profile', { start, end, steps });
        
        const profile = await ElevationService.getElevationProfile(start, end, steps);
        return res.json({ profile });
    } catch (error: any) {
        logger.error('Elevation profile error', { 
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({ error: error.message });
    }
});

// AI Analyze Endpoint (Delegating to AnalysisService)
// Uses smaller body limit (100kb) - only needs stats object and location name
app.post('/api/analyze', smallBodyParser, async (req: Request, res: Response) => {
    try {
        // Validate request with Zod schema
        const validation = analysisSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Analysis validation failed', {
                issues: validation.error.issues,
                ip: req.ip
            });
            return res.status(400).json({ 
                error: 'Invalid request',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { stats, locationName } = validation.data;
        const apiKey = process.env.GROQ_API_KEY;
        
        // Provide default location name if not provided
        const location = locationName || 'Área Selecionada';
        
        logger.info('GROQ API analysis requested', {
            locationName: location,
            hasApiKey: !!apiKey,
            timestamp: new Date().toISOString()
        });
        
        if (!apiKey) {
            logger.warn('Analysis requested but GROQ_API_KEY not configured');
            return res.status(503).json({ 
                error: 'GROQ_API_KEY not configured',
                message: 'AI analysis is unavailable. Please configure GROQ_API_KEY in the .env file to enable intelligent analysis features.',
                analysis: '**Análise AI Indisponível**\n\nPara habilitar análises inteligentes com IA, configure a variável `GROQ_API_KEY` no arquivo `.env`.\n\nObtenha sua chave gratuita em: https://console.groq.com/keys'
            });
        }

        logger.info('Processing AI analysis request', { locationName: location, hasStats: !!stats });
        // apiKey is guaranteed to be defined due to the check above
        const result = await AnalysisService.analyzeArea(stats, location, apiKey!);
        logger.info('AI analysis completed successfully', { locationName: location });
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

app.listen(port, async () => {
    const baseUrl = getBaseUrl();
    logger.info('Backend online', {
        service: 'sisRUA Unified Backend',
        version: '1.2.0',
        url: baseUrl,
        port: port
    });

    // Start Firestore monitoring if in production or if USE_FIRESTORE is enabled
    if (process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true') {
        try {
            await startFirestoreMonitoring();
            logger.info('Firestore monitoring started');
        } catch (error) {
            logger.error('Failed to start Firestore monitoring', { error });
        }
    } else {
        logger.info('Firestore disabled (development mode)');
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    stopFirestoreMonitoring();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    stopFirestoreMonitoring();
    process.exit(0);
});
