/**
 * Authentication Middleware for Cloud Tasks Webhooks
 * 
 * This middleware verifies OIDC (OpenID Connect) tokens from Google Cloud Tasks
 * to ensure that only authorized Cloud Tasks can invoke the webhook endpoints.
 * 
 * Security:
 * - Validates JWT signature using Google's public keys
 * - Verifies token audience matches our Cloud Run service
 * - Checks service account email matches expected value
 */

import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger.js';

const client = new OAuth2Client();

/**
 * Verify Cloud Tasks OIDC token
 * 
 * In production, Cloud Tasks sends requests with an Authorization header
 * containing a Bearer token (OIDC token). This function verifies:
 * 1. Token is present and valid
 * 2. Token audience matches our service URL
 * 3. Token issuer is Google
 * 4. Service account matches expected value
 */
export async function verifyCloudTasksToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // In development, skip OIDC validation
  if (process.env.NODE_ENV !== 'production') {
    logger.info('OIDC validation skipped (development mode)');
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Cloud Tasks webhook called without authorization header');
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Verify the OIDC token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.CLOUD_RUN_SERVICE_URL
    });

    const payload = ticket.getPayload();

    if (!payload) {
      logger.warn('OIDC token verification failed: no payload');
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token payload'
      });
      return;
    }

    // Verify the service account matches expected value
    const expectedServiceAccount = process.env.GCP_SERVICE_ACCOUNT;
    if (expectedServiceAccount && payload.email !== expectedServiceAccount) {
      logger.warn('OIDC token verification failed: service account mismatch', {
        expected: expectedServiceAccount,
        received: payload.email
      });
      res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid service account'
      });
      return;
    }

    logger.info('OIDC token verified successfully', {
      serviceAccount: payload.email,
      issuer: payload.iss
    });

    // Token is valid, proceed to next middleware
    next();
  } catch (error) {
    logger.error('OIDC verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
}

/**
 * Rate limiter specifically for Cloud Tasks webhook
 * 
 * This is a separate rate limiter to prevent abuse even with valid OIDC tokens.
 * Cloud Tasks should send requests at a controlled rate, so this provides
 * an additional layer of protection.
 */
import rateLimit from 'express-rate-limit';

export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Maximum 50 requests per minute (adjustable based on queue config)
  message: 'Too many webhook requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't apply rate limiting in development
    return process.env.NODE_ENV !== 'production';
  }
});
