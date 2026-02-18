import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Middleware to monitor request performance and log metrics
 */
export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const startHrTime = process.hrtime();

    // Capture original end function
    const originalEnd = res.end;

    // Override end function to capture metrics
    res.end = function (this: Response, ...args: any[]): Response {
        // Calculate duration
        const duration = Date.now() - startTime;
        const hrDuration = process.hrtime(startHrTime);
        const durationMs = hrDuration[0] * 1000 + hrDuration[1] / 1000000;

        // Log request completion
        logger.info('Request completed', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: Math.round(durationMs),
            userAgent: req.get('user-agent'),
            ip: req.ip,
            timestamp: new Date().toISOString()
        });

        // Warn about slow requests (> 5 seconds)
        if (durationMs > 5000) {
            logger.warn('Slow request detected', {
                method: req.method,
                path: req.path,
                duration: Math.round(durationMs),
                statusCode: res.statusCode
            });
        }

        // Warn about errors
        if (res.statusCode >= 400) {
            logger.warn('Request failed', {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: Math.round(durationMs)
            });
        }

        // Call original end function
        return originalEnd.apply(this, args);
    };

    next();
};

/**
 * Middleware to track API usage metrics
 */
export const metricsMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
    // Track API endpoint usage
    const endpoint = `${req.method} ${req.path}`;
    
    logger.debug('API request received', {
        endpoint,
        query: req.query,
        body: req.method === 'POST' ? '***' : undefined, // Don't log sensitive data
        timestamp: new Date().toISOString()
    });

    next();
};
