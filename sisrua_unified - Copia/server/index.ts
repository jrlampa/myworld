import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import multer from 'multer';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { GeocodingService } from './services/geocodingService.js';
import { ElevationService } from './services/elevationService.js';
import { GroqService } from './services/groqService.js';
import { fetchOpenMeteoElevations } from './services/openMeteoService.js';
import {
    createCacheKey,
    deleteCachedFilename,
    getCachedFilename,
    setCachedFilename
} from './services/cacheService.js';
import { logger } from './utils/logger.js';
import { generalRateLimiter, dxfRateLimiter } from './middleware/rateLimiter.js';
import { dxfRequestSchema } from './schemas/dxfRequest.js';
import { parseBatchCsv, RawBatchRow } from './services/batchService.js';
import { specs } from './swagger.js';
import { generateDxf } from './pythonBridge.js';
import {
    DxfTaskPayload,
    enqueueDxfTask,
    setLocalDxfTaskExecutor
} from './services/cloudTasksService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();
const port = process.env.PORT || 3001;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

type JobState = 'queued' | 'active' | 'completed' | 'failed';

type JobStatus = {
    id: string;
    status: JobState;
    progress: number;
    result: { url: string; filename: string } | null;
    error: string | null;
    createdAt: string;
    updatedAt: string;
};

const jobStatusMap = new Map<string, JobStatus>();
const frontendDistCandidates = [
    path.join(__dirname, '../../dist'),
    path.join(__dirname, '../../../dist'),
    path.join(process.cwd(), 'dist')
];

const frontendDistPath = frontendDistCandidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'index.html'))
) || path.join(process.cwd(), 'dist');

const batchRowSchema = z.object({
    name: z.string().min(1),
    lat: z.coerce.number().min(-90).max(90),
    lon: z.coerce.number().min(-180).max(180),
    radius: z.coerce.number().min(10).max(5000),
    mode: z.enum(['circle', 'polygon', 'bbox'])
});

const runWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`DXF Generation Timeout (${timeoutMs}ms)`)), timeoutMs)
    );

    return Promise.race([promise, timeout]);
};

const createDownloadUrl = (req: Request, filename: string): string => {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const host = req.get('host');
    return `${proto}://${host}/downloads/${filename}`;
};

const upsertJobStatus = (jobId: string, update: Partial<JobStatus>): JobStatus => {
    const current = jobStatusMap.get(jobId) || {
        id: jobId,
        status: 'queued' as JobState,
        progress: 0,
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const next: JobStatus = {
        ...current,
        ...update,
        updatedAt: new Date().toISOString()
    };

    jobStatusMap.set(jobId, next);
    return next;
};

const processDxfTask = async (payload: DxfTaskPayload): Promise<void> => {
    upsertJobStatus(payload.jobId, {
        status: 'active',
        progress: 15,
        error: null
    });

    await runWithTimeout(
        generateDxf({
            lat: payload.lat,
            lon: payload.lon,
            radius: payload.radius,
            mode: payload.mode,
            polygon: payload.polygon,
            layers: payload.layers,
            outputFile: payload.outputFile,
            projection: payload.projection
        }),
        60000
    );

    setCachedFilename(payload.cacheKey, payload.filename);

    upsertJobStatus(payload.jobId, {
        status: 'completed',
        progress: 100,
        result: {
            url: payload.downloadUrl,
            filename: payload.filename
        },
        error: null
    });

    logger.info('DXF job completed', {
        jobId: payload.jobId,
        cacheKey: payload.cacheKey
    });
};

setLocalDxfTaskExecutor(async (payload) => {
    try {
        await processDxfTask(payload);
    } catch (error: any) {
        logger.error('DXF job failed', {
            jobId: payload.jobId,
            cacheKey: payload.cacheKey,
            error
        });

        upsertJobStatus(payload.jobId, {
            status: 'failed',
            progress: 100,
            error: error?.message || 'DXF generation failed'
        });
    }
});

// Configuração
app.use(cors());
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
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
        status: 'online',
        service: 'sisRUA Unified Monolith',
        version: '2.0.0'
    });
});

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
});

// Serve generated files
app.use('/downloads', express.static(path.join(__dirname, '../public/dxf')));

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

        const results: Array<{ name: string; status: string; jobId?: string; url?: string }> = [];
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
                const cachedFilePath = path.join(__dirname, '../public/dxf', cachedFilename);
                if (fs.existsSync(cachedFilePath)) {
                    const cachedUrl = createDownloadUrl(req, cachedFilename);
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
            const outputFile = path.join(__dirname, '../public/dxf', filename);
            const downloadUrl = createDownloadUrl(req, filename);
            const jobId = randomUUID();

            upsertJobStatus(jobId, {
                status: 'queued',
                progress: 0,
                result: null,
                error: null
            });

            await enqueueDxfTask({
                jobId,
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

            results.push({
                name,
                status: 'queued',
                jobId
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
            const cachedFilePath = path.join(__dirname, '../public/dxf', cachedFilename);
            if (fs.existsSync(cachedFilePath)) {
                const cachedUrl = createDownloadUrl(req, cachedFilename);
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

        const filename = `dxf_${Date.now()}.dxf`;
        const outputFile = path.join(__dirname, '../public/dxf', filename);
        const downloadUrl = createDownloadUrl(req, filename);
        const jobId = randomUUID();

        logger.info('Queueing DXF generation', {
            jobId,
            lat,
            lon,
            radius,
            mode: resolvedMode,
            projection: projection || 'local',
            cacheKey
        });

        upsertJobStatus(jobId, {
            status: 'queued',
            progress: 0,
            result: null,
            error: null
        });

        await enqueueDxfTask({
            jobId,
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

        res.status(202).json({
            status: 'queued',
            jobId
        });
    } catch (err: any) {
        logger.error('DXF generation error', { error: err });
        res.status(500).json({ error: 'Generation failed', details: err.message });
    }
});

// Worker Endpoint (Cloud Tasks HTTP target)
app.post('/api/worker/dxf', async (req: Request, res: Response) => {
    const payload = req.body as Partial<DxfTaskPayload>;

    if (!payload.jobId || !payload.outputFile || !payload.downloadUrl || !payload.cacheKey) {
        return res.status(400).json({ error: 'Invalid worker payload' });
    }

    try {
        await processDxfTask(payload as DxfTaskPayload);
        return res.status(200).json({ status: 'ok', jobId: payload.jobId });
    } catch (error: any) {
        logger.error('Worker DXF processing failed', {
            jobId: payload.jobId,
            error
        });

        upsertJobStatus(payload.jobId, {
            status: 'failed',
            progress: 100,
            error: error?.message || 'DXF generation failed'
        });

        return res.status(500).json({ error: 'Worker failed', details: error?.message });
    }
});

// Job Status Endpoint
app.get('/api/jobs/:id', (req: Request, res: Response) => {
    const job = jobStatusMap.get(req.params.id);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    return res.json(job);
});

// Coordinate Search Endpoint (Using GeocodingService)
app.post('/api/search', async (req: Request, res: Response) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });

        const location = await GeocodingService.resolveLocation(query);

        if (location) {
            res.json(location);
        } else {
            res.status(404).json({ error: 'Location not found' });
        }
    } catch (error: any) {
        logger.error('Search error', { error });
        res.status(500).json({ error: error.message });
    }
});

// Elevation Profile Endpoint (Delegating to ElevationService)
app.post('/api/elevation/profile', async (req: Request, res: Response) => {
    try {
        const { start, end, steps = 25 } = req.body;
        if (!start || !end) return res.status(400).json({ error: 'Start and end coordinates required' });

        const profile = await ElevationService.getElevationProfile(start, end, steps);
        res.json({ profile });
    } catch (error: any) {
        logger.error('Elevation profile error', { error });
        res.status(500).json({ error: error.message });
    }
});

// AI Analyze Endpoint (Groq)
app.post('/api/analyze', async (req: Request, res: Response) => {
    try {
        const { stats, locationName, coordinates, coords } = req.body;
        const points = coordinates || coords;

        if (Array.isArray(points) && points.length > 0) {
            const normalized = points.map((point: any) => ({
                lat: Number(point.lat ?? point.latitude),
                lon: Number(point.lon ?? point.lng ?? point.longitude)
            }));

            if (normalized.some((point: any) => Number.isNaN(point.lat) || Number.isNaN(point.lon))) {
                return res.status(400).json({
                    success: false,
                    error: 'Coordenadas invalidas: use lat/lon ou latitude/longitude.'
                });
            }

            const elevationResult = await fetchOpenMeteoElevations(normalized, 100, 15000);
            return res.json(elevationResult);
        }

        const result = await GroqService.analyzeUrbanStats(stats, locationName || 'selected area');
        res.json(result);
    } catch (error: any) {
        logger.error('Analysis error', { error });
        res.status(500).json({ error: error.message });
    }
});

app.use(express.static(frontendDistPath));

app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
});

app.listen(port, () => {
    logger.info('Backend online', {
        service: 'sisRUA Unified Monolith',
        version: '2.0.0',
        url: `http://localhost:${port}`,
        frontendDistPath
    });
});
