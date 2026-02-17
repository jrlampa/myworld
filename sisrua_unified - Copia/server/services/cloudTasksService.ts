import { CloudTasksClient } from '@google-cloud/tasks';
import { logger } from '../utils/logger.js';

export type DxfTaskPayload = {
    jobId: string;
    lat: number;
    lon: number;
    radius: number;
    mode: string;
    polygon: string;
    layers: Record<string, boolean>;
    projection: string;
    outputFile: string;
    filename: string;
    cacheKey: string;
    downloadUrl: string;
};

type LocalExecutor = (payload: DxfTaskPayload) => Promise<void>;

const cloudTasksClient = new CloudTasksClient();
let localExecutor: LocalExecutor | null = null;

const isProduction = (): boolean => process.env.NODE_ENV === 'production';

const hasCloudTasksConfig = (): boolean => {
    return Boolean(
        process.env.GCP_PROJECT &&
        process.env.CLOUD_TASKS_LOCATION &&
        process.env.CLOUD_TASKS_QUEUE &&
        process.env.CLOUD_RUN_BASE_URL
    );
};

export const setLocalDxfTaskExecutor = (executor: LocalExecutor): void => {
    localExecutor = executor;
};

export const enqueueDxfTask = async (payload: DxfTaskPayload): Promise<void> => {
    if (!isProduction()) {
        logger.info('Cloud Tasks disabled - using in-memory fallback', { jobId: payload.jobId });

        if (!localExecutor) {
            throw new Error('Local DXF executor is not configured');
        }

        setImmediate(() => {
            localExecutor?.(payload).catch((error) => {
                logger.error('Local DXF task execution failed', { jobId: payload.jobId, error });
            });
        });

        return;
    }

    if (!hasCloudTasksConfig()) {
        throw new Error('Cloud Tasks configuration is missing in production');
    }

    const project = process.env.GCP_PROJECT!;
    const location = process.env.CLOUD_TASKS_LOCATION!;
    const queue = process.env.CLOUD_TASKS_QUEUE!;
    const baseUrl = process.env.CLOUD_RUN_BASE_URL!;
    const workerPath = process.env.CLOUD_TASKS_WORKER_PATH || '/api/worker/dxf';
    const serviceAccountEmail = process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL;

    const parent = cloudTasksClient.queuePath(project, location, queue);
    const url = `${baseUrl.replace(/\/$/, '')}${workerPath}`;

    const taskRequest: any = {
        httpRequest: {
            httpMethod: 'POST',
            url,
            headers: {
                'Content-Type': 'application/json'
            },
            body: Buffer.from(JSON.stringify(payload)).toString('base64')
        }
    };

    if (serviceAccountEmail) {
        taskRequest.httpRequest.oidcToken = {
            serviceAccountEmail,
            audience: baseUrl
        };
    }

    await cloudTasksClient.createTask({
        parent,
        task: taskRequest
    });

    logger.info('Cloud Task enqueued', {
        jobId: payload.jobId,
        queue,
        location
    });
};
