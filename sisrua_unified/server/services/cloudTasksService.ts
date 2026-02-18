import { CloudTasksClient } from '@google-cloud/tasks';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { generateDxf } from '../pythonBridge.js';
import { completeJob, failJob, updateJobStatus, createJob } from './jobStatusService.js';
import { scheduleDxfDeletion } from './dxfCleanupService.js';

// Environment variables
const GCP_PROJECT = process.env.GCP_PROJECT || '';
const CLOUD_TASKS_LOCATION = process.env.CLOUD_TASKS_LOCATION || 'southamerica-east1';
const CLOUD_TASKS_QUEUE = process.env.CLOUD_TASKS_QUEUE || 'sisrua-queue';
const CLOUD_RUN_BASE_URL = process.env.CLOUD_RUN_BASE_URL || 'http://localhost:3001';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_DEVELOPMENT = NODE_ENV === 'development' || !GCP_PROJECT;

// gRPC error codes
const GRPC_NOT_FOUND_CODE = 5;

// Initialize Cloud Tasks client
const tasksClient = new CloudTasksClient();

export interface DxfTaskPayload {
    taskId: string;
    lat: number;
    lon: number;
    radius: number;
    mode: string;
    polygon: string;
    layers: Record<string, unknown>;
    projection: string;
    outputFile: string;
    filename: string;
    cacheKey: string;
    downloadUrl: string;
}

export interface TaskCreationResult {
    taskId: string;
    taskName: string;
    alreadyCompleted?: boolean;  // For dev mode where DXF is generated immediately
}

/**
 * Creates a Cloud Task to process DXF generation
 * In development mode (when GCP_PROJECT is not set), generates DXF directly
 */
export async function createDxfTask(payload: Omit<DxfTaskPayload, 'taskId'>): Promise<TaskCreationResult> {
    const taskId = uuidv4();
    const fullPayload: DxfTaskPayload = {
        taskId,
        ...payload
    };

    // Development mode: Generate DXF directly
    if (IS_DEVELOPMENT) {
        logger.info('Development mode: Generating DXF directly (no Cloud Tasks)', {
            taskId,
            cacheKey: payload.cacheKey
        });

        try {
            // Create job FIRST (must exist before updateJobStatus)
            createJob(taskId);
            updateJobStatus(taskId, 'processing', 10);

            // Generate DXF directly using Python bridge
            await generateDxf({
                lat: payload.lat,
                lon: payload.lon,
                radius: payload.radius,
                mode: payload.mode,
                polygon: payload.polygon,
                layers: payload.layers as Record<string, boolean>,
                projection: payload.projection,
                outputFile: payload.outputFile
            });

            // Schedule DXF file for deletion after 10 minutes
            scheduleDxfDeletion(payload.outputFile);

            // Mark job as completed
            completeJob(taskId, {
                url: payload.downloadUrl,
                filename: payload.filename
            });

            logger.info('DXF generation completed (dev mode)', {
                taskId,
                filename: payload.filename,
                cacheKey: payload.cacheKey
            });

            return {
                taskId,
                taskName: `dev-task-${taskId}`,
                alreadyCompleted: true  // Job already completed in dev mode
            };
        } catch (error: any) {
            logger.error('DXF generation failed in dev mode', {
                taskId,
                error: error.message,
                stack: error.stack
            });

            failJob(taskId, error.message);
            throw new Error(`DXF generation failed: ${error.message}`);
        }
    }

    // Production mode: Use Cloud Tasks
    const parent = tasksClient.queuePath(GCP_PROJECT, CLOUD_TASKS_LOCATION, CLOUD_TASKS_QUEUE);
    
    // Construct the webhook URL
    const url = `${CLOUD_RUN_BASE_URL}/api/tasks/process-dxf`;
    
    // Prepare the task
    const task = {
        httpRequest: {
            httpMethod: 'POST' as const,
            url,
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(fullPayload)).toString('base64'),
            oidcToken: {
                serviceAccountEmail: `${GCP_PROJECT}@appspot.gserviceaccount.com`,
            },
        },
    };

    try {
        logger.info('Creating Cloud Task for DXF generation', {
            taskId,
            queueName: parent,
            url,
            cacheKey: payload.cacheKey
        });

        const [response] = await tasksClient.createTask({ parent, task });
        const taskName = response.name || '';

        logger.info('Cloud Task created successfully', {
            taskId,
            taskName,
            cacheKey: payload.cacheKey
        });

        return {
            taskId,
            taskName
        };
    } catch (error: any) {
        logger.error('Failed to create Cloud Task', {
            taskId,
            error: error.message,
            stack: error.stack,
            queueName: parent,
            gcpProject: GCP_PROJECT,
            location: CLOUD_TASKS_LOCATION,
            queue: CLOUD_TASKS_QUEUE
        });
        
        // Provide more specific error message for missing queue
        if (error.message?.includes('NOT_FOUND') || error.code === GRPC_NOT_FOUND_CODE) {
            const errorMsg = `Cloud Tasks queue '${CLOUD_TASKS_QUEUE}' not found in project '${GCP_PROJECT}' at location '${CLOUD_TASKS_LOCATION}'. ` +
                           `Please create the queue using: gcloud tasks queues create ${CLOUD_TASKS_QUEUE} --location=${CLOUD_TASKS_LOCATION}`;
            logger.error('Cloud Tasks queue does not exist', { 
                queue: parent,
                suggestion: errorMsg 
            });
            throw new Error(errorMsg);
        }
        
        throw new Error(`Failed to create Cloud Task: ${error.message}`);
    }
}

/**
 * Get task status (for compatibility with old job status endpoint)
 * Note: Cloud Tasks doesn't provide easy status checking after task is dispatched,
 * so we'll need to implement our own tracking mechanism
 */
export async function getTaskStatus(taskId: string): Promise<any> {
    // This is a placeholder - we'll implement proper status tracking
    // using an in-memory store or database
    return {
        taskId,
        status: 'unknown',
        message: 'Task status tracking not yet implemented'
    };
}
