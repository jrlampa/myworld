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

jest.mock('uuid', () => ({
  v4: () => 'test-uuid'
}));

jest.mock('../pythonBridge', () => ({
  generateDxf: jest.fn()
}));

jest.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: jest.fn(() => ({
    createTask: createTaskMock,
    queuePath: queuePathMock
  }))
}));

describe('cloudTasksService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    createTaskMock.mockResolvedValue([{ name: 'tasks/123' }]);
    queuePathMock.mockReturnValue('projects/test/locations/loc/queues/queue');
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

    await createDxfTask({
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
    });

    expect(createTaskMock).toHaveBeenCalledTimes(1);
    const taskArg = createTaskMock.mock.calls[0][0].task;
    expect(taskArg.httpRequest?.oidcToken?.serviceAccountEmail).toBe('svc@example.com');
  });
});
