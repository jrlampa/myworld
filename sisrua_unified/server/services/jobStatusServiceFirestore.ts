/**
 * Job Status Service - Firestore Implementation
 * 
 * Replaces in-memory Map with persistent Firestore storage
 * Features:
 * - Persistent storage across restarts
 * - Circuit breaker protection
 * - Automatic cleanup of old jobs
 * - Quota monitoring
 */

import { Timestamp } from '@google-cloud/firestore';
import { getFirestoreService } from './firestoreService.js';
import { logger } from '../utils/logger.js';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface JobInfo {
    id: string;
    status: JobStatus;
    progress: number;
    result?: {
        url: string;
        filename: string;
    };
    error?: string;
    createdAt: Timestamp | Date;
    updatedAt: Timestamp | Date;
}

// Use Firestore or fallback to memory (for development)
const USE_FIRESTORE = process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true';

// In-memory fallback for development
const jobs = new Map<string, JobInfo>();

/**
 * Create a new job
 */
export async function createJob(id: string): Promise<JobInfo> {
    const job: JobInfo = {
        id,
        status: 'queued',
        progress: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };

    if (USE_FIRESTORE) {
        try {
            const firestoreService = getFirestoreService();
            await firestoreService.safeWrite('jobs', id, job);
            logger.info('Job created in Firestore', { jobId: id });
        } catch (error: any) {
            // Circuit breaker or quota exceeded
            if (error.message.includes('Circuit breaker')) {
                logger.error('Job creation blocked by circuit breaker', { jobId: id, error: error.message });
                // Fallback to memory
                jobs.set(id, job);
                logger.warn('Job created in memory (fallback)', { jobId: id });
            } else {
                throw error;
            }
        }
    } else {
        jobs.set(id, job);
        logger.info('Job created in memory', { jobId: id });
    }

    return job;
}

/**
 * Get job by ID
 */
export async function getJob(id: string): Promise<JobInfo | null> {
    if (USE_FIRESTORE) {
        try {
            const firestoreService = getFirestoreService();
            const job = await firestoreService.safeRead<JobInfo>('jobs', id);
            return job;
        } catch (error: any) {
            // Circuit breaker - try memory fallback
            if (error.message.includes('Circuit breaker')) {
                logger.warn('Job read blocked by circuit breaker, checking memory', { jobId: id });
                return jobs.get(id) || null;
            }
            throw error;
        }
    }

    return jobs.get(id) || null;
}

/**
 * Update job status
 */
export async function updateJobStatus(id: string, status: JobStatus, progress?: number): Promise<void> {
    if (USE_FIRESTORE) {
        try {
            const firestoreService = getFirestoreService();
            const job = await firestoreService.safeRead<JobInfo>('jobs', id);

            if (job) {
                job.status = status;
                if (progress !== undefined) {
                    job.progress = progress;
                }
                job.updatedAt = Timestamp.now();

                await firestoreService.safeWrite('jobs', id, job);
                logger.info('Job status updated in Firestore', { jobId: id, status, progress });
            }
        } catch (error: any) {
            if (error.message.includes('Circuit breaker')) {
                logger.warn('Job update blocked by circuit breaker, updating memory', { jobId: id });
                const job = jobs.get(id);
                if (job) {
                    job.status = status;
                    if (progress !== undefined) {
                        job.progress = progress;
                    }
                    job.updatedAt = new Date();
                    jobs.set(id, job);
                }
            } else {
                throw error;
            }
        }
    } else {
        const job = jobs.get(id);
        if (job) {
            job.status = status;
            if (progress !== undefined) {
                job.progress = progress;
            }
            job.updatedAt = new Date();
            jobs.set(id, job);
            logger.info('Job status updated in memory', { jobId: id, status, progress });
        }
    }
}

/**
 * Complete a job with result
 */
export async function completeJob(id: string, result: { url: string; filename: string }): Promise<void> {
    if (USE_FIRESTORE) {
        try {
            const firestoreService = getFirestoreService();
            const job = await firestoreService.safeRead<JobInfo>('jobs', id);

            if (job) {
                job.status = 'completed';
                job.progress = 100;
                job.result = result;
                job.updatedAt = Timestamp.now();

                await firestoreService.safeWrite('jobs', id, job);
                logger.info('Job completed in Firestore', { jobId: id, filename: result.filename });
            }
        } catch (error: any) {
            if (error.message.includes('Circuit breaker')) {
                logger.warn('Job complete blocked by circuit breaker, updating memory', { jobId: id });
                const job = jobs.get(id);
                if (job) {
                    job.status = 'completed';
                    job.progress = 100;
                    job.result = result;
                    job.updatedAt = new Date();
                    jobs.set(id, job);
                }
            } else {
                throw error;
            }
        }
    } else {
        const job = jobs.get(id);
        if (job) {
            job.status = 'completed';
            job.progress = 100;
            job.result = result;
            job.updatedAt = new Date();
            jobs.set(id, job);
            logger.info('Job completed in memory', { jobId: id, filename: result.filename });
        }
    }
}

/**
 * Fail a job with error
 */
export async function failJob(id: string, error: string): Promise<void> {
    if (USE_FIRESTORE) {
        try {
            const firestoreService = getFirestoreService();
            const job = await firestoreService.safeRead<JobInfo>('jobs', id);

            if (job) {
                job.status = 'failed';
                job.error = error;
                job.updatedAt = Timestamp.now();

                await firestoreService.safeWrite('jobs', id, job);
                logger.error('Job failed in Firestore', { jobId: id, error });
            }
        } catch (error: any) {
            if (error.message.includes('Circuit breaker')) {
                logger.warn('Job fail blocked by circuit breaker, updating memory', { jobId: id });
                const job = jobs.get(id);
                if (job) {
                    job.status = 'failed';
                    job.error = error.toString();
                    job.updatedAt = new Date();
                    jobs.set(id, job);
                }
            } else {
                throw error;
            }
        }
    } else {
        const job = jobs.get(id);
        if (job) {
            job.status = 'failed';
            job.error = error;
            job.updatedAt = new Date();
            jobs.set(id, job);
            logger.error('Job failed in memory', { jobId: id, error });
        }
    }
}

/**
 * Cleanup old jobs (called by Firestore auto-cleanup)
 * For memory mode, can be called manually
 */
export function cleanupOldJobs(): void {
    if (!USE_FIRESTORE) {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        for (const [id, job] of jobs.entries()) {
            const createdAt = job.createdAt instanceof Date ? job.createdAt.getTime() : job.createdAt.toMillis();
            if (createdAt < oneHourAgo) {
                jobs.delete(id);
                logger.info('Cleaned up old job', { jobId: id });
            }
        }
    }
    // Firestore mode: cleanup handled by firestoreService
}

// Start periodic cleanup for memory mode
if (!USE_FIRESTORE) {
    setInterval(cleanupOldJobs, 60 * 60 * 1000); // Every hour
}

// Export legacy functions for backward compatibility
export function stopCleanupInterval(): void {
    // No-op in Firestore mode (handled by firestoreService)
    logger.info('Job cleanup interval stopped (handled by Firestore service)');
}
