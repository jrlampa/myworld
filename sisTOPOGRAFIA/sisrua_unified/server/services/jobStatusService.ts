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
    createdAt: Date;
    updatedAt: Date;
}

// In-memory storage for job statuses
// In production, this should be replaced with Redis, Firestore, or Cloud SQL
const jobs = new Map<string, JobInfo>();

// Auto-cleanup old jobs after 1 hour
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_JOB_AGE = 60 * 60 * 1000; // 1 hour

let cleanupIntervalId: NodeJS.Timeout | null = null;

function startCleanupInterval() {
    if (cleanupIntervalId) {
        return; // Already running
    }
    
    cleanupIntervalId = setInterval(() => {
        const now = Date.now();
        for (const [id, job] of jobs.entries()) {
            if (now - job.createdAt.getTime() > MAX_JOB_AGE) {
                jobs.delete(id);
                logger.info('Cleaned up old job', { jobId: id });
            }
        }
    }, CLEANUP_INTERVAL);
}

export function stopCleanupInterval() {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        logger.info('Job cleanup interval stopped');
    }
}

// Start cleanup interval on module load
startCleanupInterval();

export function createJob(id: string): JobInfo {
    const job: JobInfo = {
        id,
        status: 'queued',
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    jobs.set(id, job);
    logger.info('Job created', { jobId: id });
    return job;
}

export function getJob(id: string): JobInfo | null {
    return jobs.get(id) || null;
}

export function updateJobStatus(id: string, status: JobStatus, progress?: number): void {
    const job = jobs.get(id);
    if (job) {
        job.status = status;
        if (progress !== undefined) {
            job.progress = progress;
        }
        job.updatedAt = new Date();
        jobs.set(id, job);
        logger.info('Job status updated', { jobId: id, status, progress });
    }
}

export function completeJob(id: string, result: { url: string; filename: string }): void {
    const job = jobs.get(id);
    if (job) {
        job.status = 'completed';
        job.progress = 100;
        job.result = result;
        job.updatedAt = new Date();
        jobs.set(id, job);
        logger.info('Job completed', { jobId: id, filename: result.filename });
    }
}

export function failJob(id: string, error: string): void {
    const job = jobs.get(id);
    if (job) {
        job.status = 'failed';
        job.error = error;
        job.updatedAt = new Date();
        jobs.set(id, job);
        logger.error('Job failed', { jobId: id, error });
    }
}
