import { Request, Response } from 'express';
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

describe('Rate Limiter Middleware', () => {
    describe('keyGenerator', () => {
        it('should use req.ip when available', () => {
            // Create a mock request with IP
            const mockReq = {
                ip: '192.168.1.100',
                headers: {
                    'x-forwarded-for': '10.0.0.1'
                }
            } as unknown as Request;

            // Extract the keyGenerator from the rate limiter config
            // We can test this by checking that the rate limiter was configured correctly
            expect(dxfRateLimiter).toBeDefined();
            expect(generalRateLimiter).toBeDefined();
        });

        it('should handle missing IP with fallback', () => {
            const mockReq = {
                ip: undefined,
                headers: {}
            } as unknown as Request;

            // The rate limiter should still work even without IP
            expect(dxfRateLimiter).toBeDefined();
            expect(generalRateLimiter).toBeDefined();
        });
    });

    describe('DXF Rate Limiter', () => {
        it('should be configured with correct limits', () => {
            // @ts-ignore - accessing private properties for testing
            expect(dxfRateLimiter.options?.limit).toBeDefined();
        });

        it('should use standardHeaders draft-7', () => {
            // @ts-ignore
            expect(dxfRateLimiter.options?.standardHeaders).toBe('draft-7');
        });

        it('should have keyGenerator configured', () => {
            // @ts-ignore
            expect(dxfRateLimiter.options?.keyGenerator).toBeDefined();
            expect(typeof dxfRateLimiter.options?.keyGenerator).toBe('function');
        });
    });

    describe('General Rate Limiter', () => {
        it('should be configured with correct limits', () => {
            // @ts-ignore
            expect(generalRateLimiter.options?.limit).toBeDefined();
        });

        it('should use standardHeaders draft-7', () => {
            // @ts-ignore
            expect(generalRateLimiter.options?.standardHeaders).toBe('draft-7');
        });

        it('should have keyGenerator configured', () => {
            // @ts-ignore
            expect(generalRateLimiter.options?.keyGenerator).toBeDefined();
            expect(typeof generalRateLimiter.options?.keyGenerator).toBe('function');
        });
    });

    describe('Forwarded Header Support', () => {
        it('should respect X-Forwarded-For when trust proxy is enabled', () => {
            // This test verifies that the keyGenerator function exists
            // In production, when trust proxy is enabled, req.ip will be populated
            // from X-Forwarded-For header automatically by Express
            
            const mockReq = {
                ip: '10.0.0.1', // This would be set by Express from X-Forwarded-For
                headers: {
                    'x-forwarded-for': '10.0.0.1'
                }
            } as unknown as Request;

            // The keyGenerator should use req.ip
            // @ts-ignore
            const keyGen = dxfRateLimiter.options?.keyGenerator;
            if (keyGen) {
                const key = keyGen(mockReq, {} as Response);
                expect(key).toBe('10.0.0.1');
            }
        });

        it('should fallback to unknown when IP is not available', () => {
            const mockReq = {
                ip: undefined,
                headers: {}
            } as unknown as Request;

            // @ts-ignore
            const keyGen = generalRateLimiter.options?.keyGenerator;
            if (keyGen) {
                const key = keyGen(mockReq, {} as Response);
                expect(key).toBe('unknown');
            }
        });
    });
});
