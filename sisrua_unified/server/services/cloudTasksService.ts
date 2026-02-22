import { CloudTasksClient } from '@google-cloud/tasks';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { generateDxf } from '../pythonBridge.js';
import { completeJob, failJob, updateJobStatus, createJob } from './jobStatusService.js';
import { scheduleDxfDeletion } from './dxfCleanupService.js';

// Environment variables
const GCP_PROJECT = process.env.GCP_PROJECT || '';
// Prefer explicit project number envs (GCP_PROJECT_NUMBER > GOOGLE_CLOUD_PROJECT_NUMBER > PROJECT_NUMBER)
const GCP_PROJECT_NUMBER = process.env.GCP_PROJECT_NUMBER || process.env.GOOGLE_CLOUD_PROJECT_NUMBER || process.env.PROJECT_NUMBER || '';
const CLOUD_TASKS_LOCATION = process.env.CLOUD_TASKS_LOCATION || 'southamerica-east1';
const CLOUD_TASKS_QUEUE = process.env.CLOUD_TASKS_QUEUE || 'sisrua-queue';
const CLOUD_RUN_BASE_URL = process.env.CLOUD_RUN_BASE_URL || 'http://localhost:3001';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_DEVELOPMENT = NODE_ENV === 'development' || !GCP_PROJECT;
/*
 * Default service account patterns:
 * - Compute Engine default ({PROJECT_NUMBER}-compute@developer.gserviceaccount.com) used by Cloud Run when not customized
 * - App Engine default ({PROJECT_ID}@appspot.gserviceaccount.com) kept for legacy deployments
 */
const DEFAULT_COMPUTE_SERVICE_ACCOUNT = GCP_PROJECT_NUMBER ? `${GCP_PROJECT_NUMBER}-compute@developer.gserviceaccount.com` : '';
const DEFAULT_APPSPOT_SERVICE_ACCOUNT = GCP_PROJECT ? `${GCP_PROJECT}@appspot.gserviceaccount.com` : '';
// Priority: explicit override > Cloud Run service account > compute default (preferred) > appspot legacy
const RESOLVED_SERVICE_ACCOUNT_EMAIL = [
    process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL,
    process.env.CLOUD_RUN_SERVICE_ACCOUNT,
    DEFAULT_COMPUTE_SERVICE_ACCOUNT,
    DEFAULT_APPSPOT_SERVICE_ACCOUNT
].find(Boolean) || '';
// Validation happens in createDxfTask to keep development mode (without GCP vars) working.

// gRPC error codes
const GRPC_NOT_FOUND_CODE = 5;
const GRPC_PERMISSION_DENIED_CODE = 7;

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
    /** Campos ABNT NBR 10582 (opcionais) */
    designer?: string;
    numero_desenho?: string;
    revisao?: string;
    verificado_por?: string;
    aprovado_por?: string;
    /** Normas ANEEL/PRODIST — substitui ABNT para camadas elétricas */
    aneelProdist?: boolean;
}

export interface TaskCreationResult {
    taskId: string;
    taskName: string;
    alreadyCompleted?: boolean;  // For dev mode where DXF is generated immediately
}

/**
 * Generates a DXF file directly (in-process), bypassing Cloud Tasks.
 * Used in development mode and as a fallback when Cloud Tasks is unavailable.
 */
async function generateDxfDirectly(taskId: string, payload: DxfTaskPayload, taskNamePrefix: string): Promise<TaskCreationResult> {
    try {
        // Create job FIRST (must exist before updateJobStatus)
        createJob(taskId);
        updateJobStatus(taskId, 'processing', 10);

        // Generate DXF using Python bridge
        await generateDxf({
            lat: payload.lat,
            lon: payload.lon,
            radius: payload.radius,
            mode: payload.mode,
            polygon: payload.polygon,
            layers: payload.layers as Record<string, boolean>,
            projection: payload.projection,
            outputFile: payload.outputFile,
            designer: payload.designer,
            numero_desenho: payload.numero_desenho,
            revisao: payload.revisao,
            verificado_por: payload.verificado_por,
            aprovado_por: payload.aprovado_por,
            aneelProdist: payload.aneelProdist,
        });

        // Schedule DXF file for deletion after 10 minutes
        scheduleDxfDeletion(payload.outputFile);

        // Mark job as completed
        completeJob(taskId, {
            url: payload.downloadUrl,
            filename: payload.filename
        });

        logger.info('DXF generation completed (direct)', {
            taskId,
            filename: payload.filename,
            cacheKey: payload.cacheKey
        });

        return {
            taskId,
            taskName: `${taskNamePrefix}-${taskId}`,
            alreadyCompleted: true
        };
    } catch (error: any) {
        logger.error('Direct DXF generation failed', {
            taskId,
            error: error.message,
            stack: error.stack
        });
        failJob(taskId, error.message);
        throw new Error(`DXF generation failed: ${error.message}`);
    }
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

        return generateDxfDirectly(taskId, fullPayload, 'dev-task');
    }

    // Production mode: Use Cloud Tasks
    /* istanbul ignore next — RESOLVED_SERVICE_ACCOUNT_EMAIL is always non-empty when IS_DEVELOPMENT=false (GCP_PROJECT always set) */
    if (!RESOLVED_SERVICE_ACCOUNT_EMAIL) {
        const errorMsg = 'Cloud Tasks service account email not configured. Set CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL, CLOUD_RUN_SERVICE_ACCOUNT, or provide GCP_PROJECT_NUMBER/GCP_PROJECT for defaults.';
        logger.error('Missing Cloud Tasks service account email', { error: errorMsg });
        throw new Error(errorMsg);
    }

    const parent = tasksClient.queuePath(GCP_PROJECT, CLOUD_TASKS_LOCATION, CLOUD_TASKS_QUEUE);
    
    // Construct the webhook URL
    const url = `${CLOUD_RUN_BASE_URL}/api/tasks/process-dxf`;
    
    // Prepare the task
    // Note: We omit serviceAccountEmail to use the Cloud Run service's default compute service account
    // This is the recommended approach and avoids hardcoding service account emails
    const task = {
        httpRequest: {
            httpMethod: 'POST' as const,
            url,
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(fullPayload)).toString('base64'),
            oidcToken: {
                serviceAccountEmail: RESOLVED_SERVICE_ACCOUNT_EMAIL
            },
        },
    };

    try {
        logger.info('Creating Cloud Task for DXF generation', {
            taskId,
            queueName: parent,
            url,
            gcpProject: GCP_PROJECT,
            location: CLOUD_TASKS_LOCATION,
            queue: CLOUD_TASKS_QUEUE,
            serviceAccountEmail: RESOLVED_SERVICE_ACCOUNT_EMAIL,
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
            errorCode: error.code,
            stack: error.stack,
            queueName: parent,
            gcpProject: GCP_PROJECT,
            location: CLOUD_TASKS_LOCATION,
            queue: CLOUD_TASKS_QUEUE
        });
        
        const isNotFound = error.code === GRPC_NOT_FOUND_CODE;
        const isPermissionDenied = error.code === GRPC_PERMISSION_DENIED_CODE;

        // Check for permission denied errors (check code first for efficiency)
        if (isPermissionDenied) {
            // Cloud Run uses the default compute service account
            // Format: {PROJECT_NUMBER}-compute@developer.gserviceaccount.com
            logger.error('Cloud Tasks permission denied - falling back to direct DXF generation', { 
                queue: parent,
                expectedServiceAccountFormat: '{PROJECT_NUMBER}-compute@developer.gserviceaccount.com',
                hint: `Grant roles/cloudtasks.enqueuer to the Cloud Run service account for project ${GCP_PROJECT}`
            });
        }
        
        // Provide more specific error message for missing queue
        if (isNotFound) {
            logger.error('Cloud Tasks queue does not exist - falling back to direct DXF generation', { 
                queue: parent,
                hint: `Create the queue: gcloud tasks queues create ${CLOUD_TASKS_QUEUE} --location=${CLOUD_TASKS_LOCATION} --project=${GCP_PROJECT}`
            });
        }

        // Fallback: generate DXF directly when Cloud Tasks is unavailable
        if (isNotFound || isPermissionDenied) {
            logger.warn('Cloud Tasks unavailable, generating DXF directly as fallback', {
                taskId,
                reason: isNotFound ? 'queue-not-found' : 'permission-denied',
                errorCode: error.code
            });

            return generateDxfDirectly(taskId, fullPayload, 'fallback-task');
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
