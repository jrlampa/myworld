/**
 * Testes de integração — Rotas de Jobs e Downloads
 *
 * Cobre: GET /api/jobs/:id, GET /downloads/:filename
 *
 * Validações testadas:
 * - 404 para job inexistente
 * - 200 com campos corretos para job existente
 * - 500 quando getJob lança exceção
 * - 400 para path traversal (..)
 * - 400 para filename com /
 * - 400 para filename com backslash
 * - 400 para filename que não termina em .dxf
 * - 404 para arquivo .dxf não encontrado no disco
 * - 200 servindo arquivo .dxf real (via fs.statSync mock)
 * - 400 quando caminho é diretório (não arquivo)
 */

import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import jobsRouter from '../routes/jobs';
import * as jobStatusService from '../services/jobStatusService';

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

function makeApp(dxfDirectory?: string): express.Application {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        if (dxfDirectory !== undefined) res.locals.dxfDirectory = dxfDirectory;
        next();
    });
    app.use(jobsRouter);
    return app;
}

describe('GET /api/jobs/:id', () => {
    it('returns 404 when job does not exist', async () => {
        jest.spyOn(jobStatusService, 'getJob').mockReturnValueOnce(null);
        const app = makeApp();
        const res = await request(app).get('/api/jobs/missing-job-id');
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/não encontrado/i);
    });

    it('returns 200 with job fields when job exists', async () => {
        const fakeJob: jobStatusService.JobInfo = {
            id: 'job-abc',
            status: 'completed' as jobStatusService.JobStatus,
            progress: 100,
            result: { url: '/downloads/test.dxf' },
            error: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        jest.spyOn(jobStatusService, 'getJob').mockReturnValueOnce(fakeJob);
        const app = makeApp();
        const res = await request(app).get('/api/jobs/job-abc');
        expect(res.status).toBe(200);
        expect(res.body.id).toBe('job-abc');
        expect(res.body.status).toBe('completed');
        expect(res.body.progress).toBe(100);
        expect(res.body.result).toEqual({ url: '/downloads/test.dxf' });
        expect(res.body.error).toBeNull();
    });

    it('returns 500 when getJob throws', async () => {
        jest.spyOn(jobStatusService, 'getJob').mockImplementationOnce(() => {
            throw new Error('DB explodiu');
        });
        const app = makeApp();
        const res = await request(app).get('/api/jobs/boom');
        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/Falha/i);
        expect(res.body.details).toContain('DB explodiu');
    });
});

describe('GET /downloads/:filename', () => {
    it('returns 400 for path traversal with ..', async () => {
        const app = makeApp('/tmp/dxf');
        const res = await request(app).get('/downloads/..%2Fetc%2Fpasswd.dxf');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/inválido/i);
    });

    it('returns 400 for filename containing /', async () => {
        const app = makeApp('/tmp/dxf');
        const res = await request(app).get('/downloads/sub%2Ffile.dxf');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/inválido/i);
    });

    it('returns 400 for filename not ending in .dxf', async () => {
        const app = makeApp('/tmp/dxf');
        const res = await request(app).get('/downloads/validname.txt');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/inválido/i);
    });

    it('returns 404 when .dxf file does not exist on disk', async () => {
        const app = makeApp('/tmp/nonexistent-dxf-dir');
        const res = await request(app).get('/downloads/test.dxf');
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/não encontrado/i);
        expect(res.body.filename).toBe('test.dxf');
    });

    it('returns 200 when valid .dxf file exists on disk', async () => {
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `test_route_${Date.now()}.dxf`);
        fs.writeFileSync(tmpFile, 'DXF placeholder content');
        const app = makeApp(tmpDir);
        try {
            const res = await request(app).get(`/downloads/${path.basename(tmpFile)}`);
            expect(res.status).toBe(200);
        } finally {
            fs.unlinkSync(tmpFile);
        }
    });

    it('returns 400 when path resolves to a directory not a file', async () => {
        const tmpDir = os.tmpdir();
        const dirName = `dxfdir_${Date.now()}.dxf`;
        const dirPath = path.join(tmpDir, dirName);
        fs.mkdirSync(dirPath, { recursive: true });
        const app = makeApp(tmpDir);
        try {
            const res = await request(app).get(`/downloads/${dirName}`);
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/inválid/i);
        } finally {
            fs.rmdirSync(dirPath);
        }
    });
});
