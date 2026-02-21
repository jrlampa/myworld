import { jest } from '@jest/globals';

// Mock logger before importing the service
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

const createTaskMock = jest.fn();
const queuePathMock = jest.fn();
const generateDxfMock = jest.fn<() => Promise<string>>();

jest.mock('uuid', () => ({
  v4: () => 'test-uuid'
}));

jest.mock('../pythonBridge', () => ({
  generateDxf: generateDxfMock
}));

jest.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: jest.fn(() => ({
    createTask: createTaskMock,
    queuePath: queuePathMock
  }))
}));

jest.mock('../services/jobStatusService', () => ({
  createJob: jest.fn(),
  getJob: jest.fn(),
  updateJobStatus: jest.fn(),
  completeJob: jest.fn(),
  failJob: jest.fn()
}));

jest.mock('../services/dxfCleanupService', () => ({
  scheduleDxfDeletion: jest.fn()
}));

describe('cloudTasksService', () => {
  const originalEnv = process.env;

  const basePayload = {
    lat: 1,
    lon: 2,
    radius: 3,
    mode: 'circle',
    polygon: '[]',
    layers: {},
    projection: 'local',
    outputFile: '/tmp/file.dxf',
    filename: 'file.dxf',
    cacheKey: 'cache-key',
    downloadUrl: 'https://example.com/downloads/file.dxf'
  };

  beforeEach(() => {
    createTaskMock.mockResolvedValue([{ name: 'tasks/123' }]);
    queuePathMock.mockReturnValue('projects/test/locations/loc/queues/queue');
    generateDxfMock.mockResolvedValue('');
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      GCP_PROJECT: 'test-project',
      CLOUD_TASKS_LOCATION: 'loc',
      CLOUD_TASKS_QUEUE: 'queue',
      CLOUD_RUN_BASE_URL: 'https://example.com',
      CLOUD_RUN_SERVICE_ACCOUNT: 'svc@example.com'
    };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('includes service account email when creating Cloud Task', async () => {
    const { createDxfTask } = await import('../services/cloudTasksService');

    await createDxfTask(basePayload);

    expect(createTaskMock).toHaveBeenCalledTimes(1);
    const taskArg = createTaskMock.mock.calls[0][0].task;
    expect(taskArg.httpRequest?.oidcToken?.serviceAccountEmail).toBe('svc@example.com');
  });

  it('falls back to direct DXF generation when queue is NOT_FOUND (error code 5)', async () => {
    const notFoundError = Object.assign(new Error('5 NOT_FOUND: Requested entity was not found.'), { code: 5 });
    createTaskMock.mockRejectedValue(notFoundError);

    const { createDxfTask } = await import('../services/cloudTasksService');

    const result = await createDxfTask(basePayload);

    expect(result.alreadyCompleted).toBe(true);
    expect(result.taskId).toBe('test-uuid');
    expect(generateDxfMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to direct DXF generation when PERMISSION_DENIED (error code 7)', async () => {
    const permError = Object.assign(new Error('7 PERMISSION_DENIED: Permission denied.'), { code: 7 });
    createTaskMock.mockRejectedValue(permError);

    const { createDxfTask } = await import('../services/cloudTasksService');

    const result = await createDxfTask(basePayload);

    expect(result.alreadyCompleted).toBe(true);
    expect(generateDxfMock).toHaveBeenCalledTimes(1);
  });

  it('throws when Cloud Task fails with an unhandled error', async () => {
    const genericError = new Error('Internal error');
    createTaskMock.mockRejectedValue(genericError);

    const { createDxfTask } = await import('../services/cloudTasksService');

    await expect(createDxfTask(basePayload)).rejects.toThrow('Failed to create Cloud Task');
    expect(generateDxfMock).not.toHaveBeenCalled();
  });

  it('generates DXF directly in development mode (IS_DEVELOPMENT=true)', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      GCP_PROJECT: ''
    };
    jest.resetModules();

    const { createDxfTask } = await import('../services/cloudTasksService');

    const result = await createDxfTask(basePayload);

    expect(result.alreadyCompleted).toBe(true);
    expect(result.taskId).toBe('test-uuid');
    expect(generateDxfMock).toHaveBeenCalledTimes(1);
    expect(createTaskMock).not.toHaveBeenCalled();
  });

  it('throws when direct DXF generation fails in development mode', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      GCP_PROJECT: ''
    };
    jest.resetModules();
    generateDxfMock.mockRejectedValue(new Error('Python bridge error'));

    const { createDxfTask } = await import('../services/cloudTasksService');

    await expect(createDxfTask(basePayload)).rejects.toThrow('DXF generation failed: Python bridge error');
  });

  it('getTaskStatus returns placeholder status for any taskId', async () => {
    const { getTaskStatus } = await import('../services/cloudTasksService');

    const result = await getTaskStatus('some-task-id');

    expect(result.taskId).toBe('some-task-id');
    expect(result.status).toBe('unknown');
    expect(typeof result.message).toBe('string');
  });
});
