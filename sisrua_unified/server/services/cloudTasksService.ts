import { CloudTasksClient } from '@google-cloud/tasks';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const GCP_PROJECT = process.env.GCP_PROJECT || '';
const CLOUD_TASKS_LOCATION = process.env.CLOUD_TASKS_LOCATION || 'southamerica-east1';
const CLOUD_TASKS_QUEUE = process.env.CLOUD_TASKS_QUEUE || 'sisrua-queue';
const CLOUD_RUN_BASE_URL = process.env.CLOUD_RUN_BASE_URL || 'http://localhost:3001';

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
}

/**
 * Creates a Cloud Task to process DXF generation
 */
export async function createDxfTask(payload: Omit<DxfTaskPayload, 'taskId'>): Promise<TaskCreationResult> {
    const taskId = uuidv4();
    const fullPayload: DxfTaskPayload = {
        taskId,
        ...payload
    };

    // Construct the fully qualified queue name
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
            stack: error.stack
        });
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
