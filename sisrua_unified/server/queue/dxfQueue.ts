import Bull, { Job } from 'bull';
import { logger } from '../utils/logger.js';
import { generateDxf } from '../pythonBridge.js';
import { setCachedFilename } from '../services/cacheService.js';

type DxfJobData = {
    lat: number;
    lon: number;
    radius: number;
    mode: string;
    polygon: string;
    layers: Record<string, unknown>;
    projection: string;
    outputFile: string;
    filename: string;
    cacheKey: string;
    downloadUrl: string;
};

type DxfJobResult = {
    url: string;
    filename: string;
};

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const dxfQueue = new Bull<DxfJobData>('dxf-generation', redisUrl);

const runWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`DXF Generation Timeout (${timeoutMs}ms)`)), timeoutMs)
    );

    return Promise.race([promise, timeout]);
};

dxfQueue.process(1, async (job: Job<DxfJobData>): Promise<DxfJobResult> => {
    logger.info('DXF job started', {
        jobId: job.id,
        cacheKey: job.data.cacheKey
    });

    await runWithTimeout(
        generateDxf({
            lat: job.data.lat,
            lon: job.data.lon,
            radius: job.data.radius,
            mode: job.data.mode,
            polygon: job.data.polygon,
            layers: job.data.layers,
            projection: job.data.projection,
            outputFile: job.data.outputFile
        }),
        60000
    );

    setCachedFilename(job.data.cacheKey, job.data.filename);

    return {
        url: job.data.downloadUrl,
        filename: job.data.filename
    };
});

dxfQueue.on('completed', (job) => {
    logger.info('DXF job completed', {
        jobId: job.id,
        cacheKey: job.data.cacheKey
    });
});

dxfQueue.on('failed', (job, error) => {
    logger.error('DXF job failed', {
        jobId: job?.id,
        cacheKey: job?.data?.cacheKey,
        error
    });
});

export { dxfQueue };
