/**
 * Testes de integração — getBaseUrl e rota /api/dxf completa
 *
 * Cobre: getBaseUrl() (3 cenários), POST /api/dxf → 400/500/202/200
 *        POST /api/batch/dxf → 400/200/cache hit
 */

import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getBaseUrl } from '../routes/dxf';

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../services/cacheService', () => ({
    createCacheKey: jest.fn(() => 'test-cache-key'),
    getCachedFilename: jest.fn(() => null),
    setCachedFilename: jest.fn(),
    deleteCachedFilename: jest.fn(),
}));

jest.mock('../services/cloudTasksService', () => ({
    createDxfTask: jest.fn().mockResolvedValue({ taskId: 'task-123', alreadyCompleted: false }),
}));

jest.mock('../services/jobStatusService', () => ({
    createJob: jest.fn(),
    stopCleanupInterval: jest.fn(),
}));

jest.mock('../services/dxfCleanupService', () => ({
    scheduleDxfDeletion: jest.fn(),
}));

jest.mock('../services/analyticsService', () => ({
    __esModule: true,
    default: { record: jest.fn() },
}));

jest.mock('../middleware/rateLimiter', () => ({
    dxfRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../pythonBridge', () => ({
    generateDxf: jest.fn().mockResolvedValue('done'),
}));

// Import mocked modules to access their jest.fn() references
import * as cacheService from '../services/cacheService';
import * as cloudTasksService from '../services/cloudTasksService';
import * as jobStatusService from '../services/jobStatusService';
import analyticsService from '../services/analyticsService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dxfRouter = require('../routes/dxf').default;

function makeApp(dxfDirectory: string): express.Application {
    const app = express();
    app.use(express.json({ limit: '5mb' }));
    app.use((req, res, next) => {
        res.locals.dxfDirectory = dxfDirectory;
        next();
    });
    app.use(dxfRouter);
    return app;
}

const VALID_BODY = { lat: -22.15018, lon: -42.92185, radius: 500, mode: 'circle' };

function makeReqLike(headers: Record<string, string> = {}, protocol = 'http', host = 'localhost:3001') {
    return {
        get: (name: string) => headers[name.toLowerCase()] || (name === 'host' ? host : undefined),
        protocol,
        headers,
    } as any;
}

// ─── getBaseUrl ─────────────────────────────────────────────────────────────

describe('getBaseUrl()', () => {
    const orig = process.env.CLOUD_RUN_BASE_URL;
    afterEach(() => {
        if (orig === undefined) delete process.env.CLOUD_RUN_BASE_URL;
        else process.env.CLOUD_RUN_BASE_URL = orig;
    });

    it('returns CLOUD_RUN_BASE_URL when set', () => {
        process.env.CLOUD_RUN_BASE_URL = 'https://sisrua.run.app';
        expect(getBaseUrl(makeReqLike(), 3001)).toBe('https://sisrua.run.app');
    });

    it('uses x-forwarded-proto + x-forwarded-host when present', () => {
        delete process.env.CLOUD_RUN_BASE_URL;
        const req = makeReqLike({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'api.example.com' });
        expect(getBaseUrl(req, 3001)).toBe('https://api.example.com');
    });

    it('falls back to req.protocol + req.get("host")', () => {
        delete process.env.CLOUD_RUN_BASE_URL;
        expect(getBaseUrl(makeReqLike({}, 'http', 'myserver:9000'), 3001)).toBe('http://myserver:9000');
    });

    it('falls back to http://localhost:PORT when req has no protocol or host', () => {
        delete process.env.CLOUD_RUN_BASE_URL;
        const req = { get: () => undefined, protocol: undefined, headers: {} } as any;
        expect(getBaseUrl(req, 3001)).toBe('http://localhost:3001');
    });
});

// ─── POST /api/dxf — validação Zod ──────────────────────────────────────────

describe('POST /api/dxf — Zod validation', () => {
    const app = makeApp('/tmp/dxf-zod-test');

    it('returns 400 when body is missing required fields', async () => {
        const res = await request(app).post('/api/dxf').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/inválido/i);
        expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('returns 400 when lat is out of range', async () => {
        const res = await request(app).post('/api/dxf').send({ lat: 200, lon: -42.92185, radius: 500, mode: 'circle' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/inválido/i);
    });
});

// ─── POST /api/dxf — fluxo completo ─────────────────────────────────────────

describe('POST /api/dxf — full handler flow', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sisrua-dxf-'));
        jest.clearAllMocks();
        // Reset cache to miss by default
        (cacheService.getCachedFilename as jest.Mock).mockReturnValue(null);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns 500 when DXF directory does not exist', async () => {
        const res = await request(makeApp('/nonexistent-dir-xyz-123')).post('/api/dxf').send(VALID_BODY);
        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/configuração/i);
    });

    it('returns 202 (queued) on cache miss + task created', async () => {
        (cloudTasksService.createDxfTask as jest.Mock).mockResolvedValue({ taskId: 'task-789', alreadyCompleted: false });
        const res = await request(makeApp(tmpDir)).post('/api/dxf').send(VALID_BODY);
        expect(res.status).toBe(202);
        expect(res.body.status).toBe('queued');
        expect(res.body.jobId).toBe('task-789');
        expect(jobStatusService.createJob).toHaveBeenCalledWith('task-789');
    });

    it('handles body with polygon as string and no layers (branch coverage)', async () => {
        (cloudTasksService.createDxfTask as jest.Mock).mockResolvedValue({ taskId: 'task-poly', alreadyCompleted: false });
        const body = { ...VALID_BODY, polygon: '[[0,0],[1,1]]', layers: null };
        const res = await request(makeApp(tmpDir)).post('/api/dxf').send(body);
        expect(res.status).toBe(202);
    });

    it('handles body with polygon as array (non-string branch in cacheKey)', async () => {
        (cloudTasksService.createDxfTask as jest.Mock).mockResolvedValue({ taskId: 'task-arr', alreadyCompleted: false });
        const body = { ...VALID_BODY, polygon: [[0, 0], [1, 1]] };
        const res = await request(makeApp(tmpDir)).post('/api/dxf').send(body);
        expect(res.status).toBe(202);
    });

    it('returns 200 with URL on cache hit (file exists on disk)', async () => {
        const cachedName = `hit_${Date.now()}.dxf`;
        fs.writeFileSync(path.join(tmpDir, cachedName), 'DXF content');
        (cacheService.getCachedFilename as jest.Mock).mockReturnValue(cachedName);
        const res = await request(makeApp(tmpDir)).post('/api/dxf').send(VALID_BODY);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body.url).toContain(cachedName);
    });

    it('falls through to queue when cached file is missing from disk', async () => {
        (cacheService.getCachedFilename as jest.Mock).mockReturnValue('ghost.dxf');
        (cloudTasksService.createDxfTask as jest.Mock).mockResolvedValue({ taskId: 'task-ft', alreadyCompleted: false });
        const res = await request(makeApp(tmpDir)).post('/api/dxf').send(VALID_BODY);
        expect(cacheService.deleteCachedFilename).toHaveBeenCalled();
        expect(res.status).toBe(202);
    });

    it('returns 200 with immediate URL when alreadyCompleted=true (dev mode)', async () => {
        (cloudTasksService.createDxfTask as jest.Mock).mockResolvedValue({ taskId: 'task-dev', alreadyCompleted: true });
        const res = await request(makeApp(tmpDir)).post('/api/dxf').send(VALID_BODY);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('success');
        expect(res.body).toHaveProperty('url');
        expect(jobStatusService.createJob).not.toHaveBeenCalled();
    });

    it('returns 500 when createDxfTask throws', async () => {
        (cloudTasksService.createDxfTask as jest.Mock).mockRejectedValue(new Error('Cloud Tasks unavailable'));
        const res = await request(makeApp(tmpDir)).post('/api/dxf').send(VALID_BODY);
        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/Falha/i);
    });
});

// ─── POST /api/batch/dxf ────────────────────────────────────────────────────

describe('POST /api/batch/dxf', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sisrua-batch-'));
        jest.clearAllMocks();
        (cacheService.getCachedFilename as jest.Mock).mockReturnValue(null);
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns 400 when no file is uploaded', async () => {
        const res = await request(makeApp(tmpDir)).post('/api/batch/dxf');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/CSV obrigatório/i);
    });

    it('returns 400 when CSV is empty', async () => {
        const res = await request(makeApp(tmpDir))
            .post('/api/batch/dxf')
            .attach('file', Buffer.from(''), 'empty.csv');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/vazio|inválido/i);
    });

    it('returns 200 with queued results for valid CSV rows', async () => {
        (cloudTasksService.createDxfTask as jest.Mock).mockResolvedValue({ taskId: 'bt-1', alreadyCompleted: false });
        const csv = 'name,lat,lon,radius,mode\nTestA,-22.15018,-42.92185,500,circle\n';
        const res = await request(makeApp(tmpDir))
            .post('/api/batch/dxf')
            .attach('file', Buffer.from(csv), 'batch.csv');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.results)).toBe(true);
        expect(res.body.results[0].name).toBe('TestA');
        expect(res.body.results[0].status).toBe('queued');
    });

    it('returns 400 when all CSV rows are invalid', async () => {
        const csv = 'name,lat,lon,radius,mode\nBad,not-a-lat,bad,0,circle\n';
        const res = await request(makeApp(tmpDir))
            .post('/api/batch/dxf')
            .attach('file', Buffer.from(csv), 'bad.csv');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/nenhuma.*válida|inválid/i);
    });

    it('returns cached URL when batch row has a cache hit with file on disk', async () => {
        const cachedName = `bcache_${Date.now()}.dxf`;
        fs.writeFileSync(path.join(tmpDir, cachedName), 'DXF');
        (cacheService.getCachedFilename as jest.Mock).mockReturnValue(cachedName);
        const csv = 'name,lat,lon,radius,mode\nCached,-22.15018,-42.92185,500,circle\n';
        const res = await request(makeApp(tmpDir))
            .post('/api/batch/dxf')
            .attach('file', Buffer.from(csv), 'cached.csv');
        expect(res.status).toBe(200);
        expect(res.body.results[0].status).toBe('cached');
        expect(res.body.results[0].url).toContain(cachedName);
    });

    it('falls through to queue when batch cache hit but file missing from disk', async () => {
        (cacheService.getCachedFilename as jest.Mock).mockReturnValue('ghost_batch.dxf');
        (cloudTasksService.createDxfTask as jest.Mock).mockResolvedValue({ taskId: 'bt-ghost', alreadyCompleted: false });
        const csv = 'name,lat,lon,radius,mode\nGhost,-22.15018,-42.92185,500,circle\n';
        const res = await request(makeApp(tmpDir))
            .post('/api/batch/dxf')
            .attach('file', Buffer.from(csv), 'ghost.csv');
        expect(cacheService.deleteCachedFilename).toHaveBeenCalled();
        expect(res.status).toBe(200);
        expect(res.body.results[0].status).toBe('queued');
    });

    it('returns 500 when an unexpected error occurs in batch handler', async () => {
        (cacheService.getCachedFilename as jest.Mock).mockReturnValue(null);
        (cloudTasksService.createDxfTask as jest.Mock).mockRejectedValue(new Error('Batch explodiu'));
        const csv = 'name,lat,lon,radius,mode\nErrorRow,-22.15018,-42.92185,500,circle\n';
        const res = await request(makeApp(tmpDir))
            .post('/api/batch/dxf')
            .attach('file', Buffer.from(csv), 'error.csv');
        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/lote/i);
    });
});
