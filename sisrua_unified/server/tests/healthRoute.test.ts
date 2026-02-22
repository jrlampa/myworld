/**
 * Testes de integração — Rotas de Health
 *
 * Cobre: GET /health, GET /api/firestore/status
 *
 * Validações testadas:
 * - 200 com status online e campos obrigatórios (python real ou não disponível)
 * - python: 'unavailable' quando PYTHON_COMMAND não existe no PATH
 * - python: 'degraded' quando PYTHON_COMMAND é valor não permitido
 * - /api/firestore/status retorna enabled:false em modo de desenvolvimento
 * - /api/firestore/status retorna 500 quando Firestore lança exceção
 */

import request from 'supertest';
import express from 'express';
import { SERVER_VERSION } from '../version';

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

jest.mock('../services/firestoreService', () => ({
    getFirestoreService: jest.fn(),
    startFirestoreMonitoring: jest.fn(),
    stopFirestoreMonitoring: jest.fn(),
}));

import healthRouter from '../routes/health';

function makeApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use(healthRouter);
    return app;
}

describe('GET /health', () => {
    const origPythonCmd = process.env.PYTHON_COMMAND;

    afterEach(() => {
        if (origPythonCmd === undefined) delete process.env.PYTHON_COMMAND;
        else process.env.PYTHON_COMMAND = origPythonCmd;
    });

    it('returns 200 with required fields (python either available or unavailable)', async () => {
        const app = makeApp();
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.service).toBe('sisRUA Unified Backend');
        expect(res.body.version).toBe(SERVER_VERSION);
        expect(['online', 'degraded']).toContain(res.body.status);
        expect(['available', 'unavailable']).toContain(res.body.python);
        expect(res.body).toHaveProperty('environment');
        expect(res.body).toHaveProperty('groqApiKey');
    });

    it('reports python as unavailable when PYTHON_COMMAND binary does not exist', async () => {
        process.env.PYTHON_COMMAND = 'python3';
        // Set to a non-existent binary to get 'unavailable'
        process.env.PYTHON_COMMAND = 'python_does_not_exist_in_path_xyz';
        const app = makeApp();
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        // Either timeout (unavailable) or spawn error (unavailable) — both are valid
        expect(res.body.python).toBe('unavailable');
    }, 10000);

    it('returns degraded status when PYTHON_COMMAND contains invalid characters (not in allowlist)', async () => {
        process.env.PYTHON_COMMAND = 'python4_not_allowed';
        const app = makeApp();
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('degraded');
        expect(res.body.python).toBe('unavailable');
    });
});

describe('GET /api/firestore/status', () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origUseFirestore = process.env.USE_FIRESTORE;

    afterEach(() => {
        if (origNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = origNodeEnv;
        if (origUseFirestore === undefined) delete process.env.USE_FIRESTORE;
        else process.env.USE_FIRESTORE = origUseFirestore;
    });

    it('returns enabled:false in development mode (Firestore disabled)', async () => {
        process.env.USE_FIRESTORE = 'false';
        process.env.NODE_ENV = 'test';
        const app = makeApp();
        const res = await request(app).get('/api/firestore/status');
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(false);
        expect(res.body.mode).toBe('memory');
        expect(res.body.message).toContain('desativado');
    });

    it('returns 500 when Firestore service throws', async () => {
        process.env.USE_FIRESTORE = 'true';
        const firestoreService = require('../services/firestoreService');
        firestoreService.getFirestoreService.mockImplementationOnce(() => {
            throw new Error('Firestore connection failed');
        });
        const app = makeApp();
        const res = await request(app).get('/api/firestore/status');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Firestore connection failed');
    });

    it('returns enabled:true with quota data when Firestore is active (circuit closed)', async () => {
        process.env.USE_FIRESTORE = 'true';
        const firestoreService = require('../services/firestoreService');
        firestoreService.getFirestoreService.mockReturnValueOnce({
            getCircuitBreakerStatus: () => ({ isOpen: false, operation: null, usage: 0, limit: 0 }),
            getCurrentUsage: async () => ({
                date: '2026-02-21', reads: 100, writes: 50, deletes: 10,
                storageBytes: 1024 * 1024, lastUpdated: new Date().toISOString(),
            }),
        });
        const app = makeApp();
        const res = await request(app).get('/api/firestore/status');
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(true);
        expect(res.body.mode).toBe('firestore');
        expect(res.body.quotas.reads.current).toBe(100);
        expect(res.body.circuitBreaker.status).toBe('CLOSED');
        expect(res.body.circuitBreaker.message).toBe('Todas as operações permitidas');
    });

    it('returns circuitBreaker OPEN when isOpen=true', async () => {
        process.env.USE_FIRESTORE = 'true';
        const firestoreService = require('../services/firestoreService');
        firestoreService.getFirestoreService.mockReturnValueOnce({
            getCircuitBreakerStatus: () => ({ isOpen: true, operation: 'write', usage: 20000, limit: 20000 }),
            getCurrentUsage: async () => ({
                date: '2026-02-21', reads: 0, writes: 20000, deletes: 0,
                storageBytes: 0, lastUpdated: new Date().toISOString(),
            }),
        });
        const app = makeApp();
        const res = await request(app).get('/api/firestore/status');
        expect(res.status).toBe(200);
        expect(res.body.circuitBreaker.status).toBe('OPEN');
        expect(res.body.circuitBreaker.message).toMatch(/write/);
    });
});

