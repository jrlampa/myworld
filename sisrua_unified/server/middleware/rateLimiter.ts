import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Custom key generator that uses the client IP address
 * This respects X-Forwarded-For and Forwarded headers when trust proxy is enabled
 * Uses ipKeyGenerator to properly handle both IPv4 and IPv6 addresses
 * Fixes: ValidationError about Forwarded header being ignored
 */
const keyGenerator = (req: Request): string => {
    // Extract IP from Forwarded header if present (standardized header)
    const forwardedHeader = req.headers.forwarded as string | undefined;
    if (forwardedHeader) {
        // Parse Forwarded header: "for=192.0.2.60;proto=http;by=203.0.113.43"
        const forMatch = forwardedHeader.match(/for=([^;,\s]+)/);
        if (forMatch) {
            // Remove quotes and "for=" prefix, extract just the IP
            const ip = forMatch[1].replace(/["\[\]]/g, '');
            return ipKeyGenerator(ip);
        }
    }
    
    // Fall back to req.ip (which handles X-Forwarded-For when trust proxy is enabled)
    return ipKeyGenerator(req.ip || 'unknown');
};

const dxfRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    message: { error: 'Too many DXF requests, please try again later.' },
    handler: (req, res, _next, options) => {
        logger.warn('DXF rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            limit: options.limit,
            windowMs: options.windowMs
        });
        res.status(options.statusCode).json(options.message);
    }
});

const generalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    message: { error: 'Too many requests, please try again later.' },
    handler: (req, res, _next, options) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            limit: options.limit,
            windowMs: options.windowMs
        });
        res.status(options.statusCode).json(options.message);
    }
});

export { dxfRateLimiter, generalRateLimiter };
