/**
 * Testes de integração — Rotas de Analytics
 *
 * Cobre: GET /api/analytics, GET /api/analytics/events
 */

import request from 'supertest';
import express from 'express';
import analyticsRouter from '../routes/analytics';
import analyticsService from '../services/analyticsService';

function makeEvent(overrides = {}) {
    return {
        timestamp: Date.now(),
        lat: -22.15018,
        lon: -42.92185,
        radius: 500,
        mode: 'circle' as const,
        success: true,
        durationMs: 1000,
        isBatch: false,
        ...overrides,
    };
}

describe('Rotas de Analytics', () => {
    let app: express.Application;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(analyticsRouter);
    });

    beforeEach(() => {
        analyticsService.clear();
    });

    describe('GET /api/analytics', () => {
        it('deve retornar status ok e sumário zerado sem eventos', async () => {
            const res = await request(app).get('/api/analytics');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.data).toBeDefined();
            expect(res.body.data.totalExports).toBe(0);
            expect(res.body.data.successRate).toBe(0);
            expect(res.body.data.exportsByHour).toHaveLength(24);
        });

        it('deve refletir eventos registrados no sumário', async () => {
            analyticsService.record(makeEvent({ success: true, durationMs: 2000, radius: 300 }));
            analyticsService.record(makeEvent({ success: false, mode: 'polygon' }));

            const res = await request(app).get('/api/analytics');
            expect(res.status).toBe(200);
            const data = res.body.data;
            expect(data.totalExports).toBe(2);
            expect(data.successfulExports).toBe(1);
            expect(data.failedExports).toBe(1);
            expect(data.exportsByMode.circle).toBe(1);
            expect(data.exportsByMode.polygon).toBe(1);
        });

        it('deve retornar exportsByMode com circle e polygon', async () => {
            analyticsService.record(makeEvent({ mode: 'circle' }));
            analyticsService.record(makeEvent({ mode: 'polygon' }));
            analyticsService.record(makeEvent({ mode: 'circle' }));

            const res = await request(app).get('/api/analytics');
            expect(res.status).toBe(200);
            expect(res.body.data.exportsByMode.circle).toBe(2);
            expect(res.body.data.exportsByMode.polygon).toBe(1);
        });

        it('deve retornar JSON com Content-Type correto', async () => {
            const res = await request(app).get('/api/analytics');
            expect(res.type).toBe('application/json');
        });
    });

    describe('GET /api/analytics/events', () => {
        it('deve retornar status ok e array vazio sem eventos', async () => {
            const res = await request(app).get('/api/analytics/events');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(0);
        });

        it('deve retornar eventos registrados em ordem decrescente', async () => {
            const now = Date.now();
            analyticsService.record(makeEvent({ timestamp: now - 2000 }));
            analyticsService.record(makeEvent({ timestamp: now - 1000 }));

            const res = await request(app).get('/api/analytics/events');
            expect(res.status).toBe(200);
            const events = res.body.data;
            expect(events.length).toBeGreaterThan(0);
            // Mais recente primeiro
            if (events.length >= 2) {
                expect(events[0].timestamp).toBeGreaterThanOrEqual(events[1].timestamp);
            }
        });

        it('deve retornar no máximo 20 eventos', async () => {
            for (let i = 0; i < 25; i++) {
                analyticsService.record(makeEvent({ timestamp: Date.now() + i }));
            }
            const res = await request(app).get('/api/analytics/events');
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeLessThanOrEqual(20);
        });
    });
});
