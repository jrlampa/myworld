import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { dxfRateLimiter, generalRateLimiter } from '../middleware/rateLimiter';

// Mock logger
jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

/** Helper: create a minimal Express app with the given rate limiter applied */
function makeApp(limiter: (req: Request, res: Response, next: NextFunction) => void) {
    const app = express();
    app.use(limiter);
    app.get('/test', (_req, res) => res.json({ ok: true }));
    return app;
}

describe('Rate Limiter Middleware', () => {
    describe('Rate Limiter Configuration', () => {
        it('should export dxfRateLimiter', () => {
            expect(dxfRateLimiter).toBeDefined();
            expect(typeof dxfRateLimiter).toBe('function');
        });

        it('should export generalRateLimiter', () => {
            expect(generalRateLimiter).toBeDefined();
            expect(typeof generalRateLimiter).toBe('function');
        });
    });

    describe('keyGenerator — Forwarded header parsing', () => {
        it('should allow request with plain IPv4 Forwarded header', async () => {
            const app = makeApp(generalRateLimiter);
            const res = await request(app)
                .get('/test')
                .set('Forwarded', 'for=203.0.113.1');
            expect(res.status).toBe(200);
        });

        it('should allow request with IPv4:port in Forwarded header', async () => {
            const app = makeApp(generalRateLimiter);
            const res = await request(app)
                .get('/test')
                .set('Forwarded', 'for="203.0.113.2:47011"');
            expect(res.status).toBe(200);
        });

        it('should allow request with IPv6 in Forwarded header', async () => {
            const app = makeApp(generalRateLimiter);
            const res = await request(app)
                .get('/test')
                .set('Forwarded', 'for="[2001:db8::1]"');
            expect(res.status).toBe(200);
        });

        it('should fall back to req.ip for obfuscated Forwarded identifier', async () => {
            const app = makeApp(generalRateLimiter);
            const res = await request(app)
                .get('/test')
                .set('Forwarded', 'for=_hidden');
            expect(res.status).toBe(200);
        });

        it('should fall back to req.ip when Forwarded header is absent', async () => {
            const app = makeApp(generalRateLimiter);
            const res = await request(app).get('/test');
            expect(res.status).toBe(200);
        });

        it('should allow request with multi-hop Forwarded header', async () => {
            const app = makeApp(generalRateLimiter);
            const res = await request(app)
                .get('/test')
                .set('Forwarded', 'for=203.0.113.5;proto=http;by=10.0.0.1');
            expect(res.status).toBe(200);
        });
    });

    describe('DXF rate limiter', () => {
        it('should allow a single DXF request through', async () => {
            const app = makeApp(dxfRateLimiter);
            const res = await request(app).get('/test');
            expect(res.status).toBe(200);
        });

        it('deve chamar o handler do dxfRateLimiter ao exceder 10 req/hora', async () => {
            const app = makeApp(dxfRateLimiter);
            const uniqueIp = '198.51.100.42'; // IP dedicado a este teste
            for (let i = 0; i < 10; i++) {
                await request(app).get('/test').set('Forwarded', `for=${uniqueIp}`);
            }
            const res = await request(app).get('/test').set('Forwarded', `for=${uniqueIp}`);
            expect(res.status).toBe(429);
            expect(res.body.error).toBeDefined();
        });
    });

    describe('General rate limiter', () => {
        it('should allow a single request through', async () => {
            const app = makeApp(generalRateLimiter);
            const res = await request(app).get('/test');
            expect(res.status).toBe(200);
        });

        it('deve chamar o handler do generalRateLimiter ao exceder 100 req/15min', async () => {
            const app = makeApp(generalRateLimiter);
            const uniqueIp = '198.51.100.99'; // IP dedicado a este teste
            for (let i = 0; i < 100; i++) {
                await request(app).get('/test').set('Forwarded', `for=${uniqueIp}`);
            }
            const res = await request(app).get('/test').set('Forwarded', `for=${uniqueIp}`);
            expect(res.status).toBe(429);
            expect(res.body.error).toBeDefined();
        });
    });
});
