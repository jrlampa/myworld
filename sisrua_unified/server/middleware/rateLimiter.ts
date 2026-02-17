import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

const dxfRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
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
