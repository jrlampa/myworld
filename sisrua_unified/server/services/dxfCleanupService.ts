import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

// DXF files should be deleted after 10 minutes as per requirements
const DXF_FILE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_CHECK_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes

interface ScheduledFile {
    filePath: string;
    deleteAt: number;
}

// Track files scheduled for deletion
const scheduledDeletions = new Map<string, ScheduledFile>();
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Schedule a DXF file for deletion after 10 minutes
 */
export function scheduleDxfDeletion(filePath: string): void {
    const deleteAt = Date.now() + DXF_FILE_TTL_MS;
    
    scheduledDeletions.set(filePath, {
        filePath,
        deleteAt
    });
    
    logger.info('DXF file scheduled for deletion', {
        filePath,
        deleteAt: new Date(deleteAt).toISOString(),
        ttlMinutes: 10
    });
}

/**
 * Perform cleanup of expired DXF files
 */
function performCleanup(): void {
    const now = Date.now();
    const filesToDelete: string[] = [];
    
    for (const [filePath, scheduled] of scheduledDeletions.entries()) {
        if (now >= scheduled.deleteAt) {
            filesToDelete.push(filePath);
        }
    }
    
    for (const filePath of filesToDelete) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info('DXF file deleted successfully', {
                    filePath,
                    age: 'expired'
                });
            } else {
                logger.warn('DXF file already deleted or not found', { filePath });
            }
        } catch (error: any) {
            logger.error('Failed to delete DXF file', {
                filePath,
                error: error.message
            });
        }
        
        scheduledDeletions.delete(filePath);
    }
    
    if (filesToDelete.length > 0) {
        logger.info('DXF cleanup cycle completed', {
            deletedCount: filesToDelete.length,
            remainingScheduled: scheduledDeletions.size
        });
    }
}

/**
 * Start the periodic cleanup interval
 */
function startCleanupInterval(): void {
    if (cleanupIntervalId) {
        return; // Already running
    }
    
    cleanupIntervalId = setInterval(() => {
        performCleanup();
    }, CLEANUP_CHECK_INTERVAL);
    
    logger.info('DXF cleanup service started', {
        checkIntervalMs: CLEANUP_CHECK_INTERVAL,
        fileTTLMs: DXF_FILE_TTL_MS
    });
}

/**
 * Stop the cleanup interval (for graceful shutdown)
 */
export function stopDxfCleanup(): void {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        logger.info('DXF cleanup service stopped');
    }
}

/**
 * Manually trigger cleanup (useful for testing)
 */
export function triggerCleanupNow(): void {
    performCleanup();
}

// Start cleanup interval on module load
startCleanupInterval();
