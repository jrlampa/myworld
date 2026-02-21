/**
 * Testes unitários — JobStatusService (in-memory)
 *
 * Cobre: createJob, getJob, updateJobStatus, completeJob, failJob, stopCleanupInterval
 */

import {
    createJob,
    getJob,
    updateJobStatus,
    completeJob,
    failJob,
    stopCleanupInterval,
    JobInfo,
    JobStatus
} from '../services/jobStatusService';

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

afterAll(() => {
    stopCleanupInterval();
});

describe('JobStatusService', () => {
    const jobId = () => `test-job-${Date.now()}-${Math.random()}`;

    describe('createJob', () => {
        it('deve criar um job com status queued e progress 0', () => {
            const id = jobId();
            const job = createJob(id);
            expect(job.id).toBe(id);
            expect(job.status).toBe('queued');
            expect(job.progress).toBe(0);
            expect(job.createdAt).toBeInstanceOf(Date);
            expect(job.updatedAt).toBeInstanceOf(Date);
        });

        it('deve retornar o job após criação via getJob', () => {
            const id = jobId();
            createJob(id);
            const found = getJob(id);
            expect(found).not.toBeNull();
            expect(found!.id).toBe(id);
        });
    });

    describe('getJob', () => {
        it('deve retornar null para job inexistente', () => {
            expect(getJob('id-inexistente-xyz')).toBeNull();
        });

        it('deve retornar o job correto pelo id', () => {
            const id = jobId();
            createJob(id);
            const found = getJob(id);
            expect(found).not.toBeNull();
            expect(found!.id).toBe(id);
        });
    });

    describe('updateJobStatus', () => {
        it('deve atualizar status e progress do job', () => {
            const id = jobId();
            createJob(id);
            updateJobStatus(id, 'processing', 50);
            const job = getJob(id)!;
            expect(job.status).toBe('processing');
            expect(job.progress).toBe(50);
        });

        it('deve atualizar status sem alterar progress se não fornecido', () => {
            const id = jobId();
            createJob(id);
            updateJobStatus(id, 'processing');
            const job = getJob(id)!;
            expect(job.status).toBe('processing');
            expect(job.progress).toBe(0);
        });

        it('deve logar erro para job inexistente', () => {
            const { logger } = require('../utils/logger');
            updateJobStatus('id-inexistente-xyz', 'processing', 50);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('completeJob', () => {
        it('deve marcar job como completed com result e progress 100', () => {
            const id = jobId();
            createJob(id);
            const result = { url: '/downloads/output.dxf', filename: 'output.dxf' };
            completeJob(id, result);
            const job = getJob(id)!;
            expect(job.status).toBe('completed');
            expect(job.progress).toBe(100);
            expect(job.result).toEqual(result);
        });

        it('deve logar erro para job inexistente', () => {
            const { logger } = require('../utils/logger');
            completeJob('id-inexistente-xyz', { url: '/dl/x.dxf', filename: 'x.dxf' });
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('failJob', () => {
        it('deve marcar job como failed com mensagem de erro', () => {
            const id = jobId();
            createJob(id);
            failJob(id, 'Erro ao gerar DXF');
            const job = getJob(id)!;
            expect(job.status).toBe('failed');
            expect(job.error).toBe('Erro ao gerar DXF');
        });

        it('deve logar erro para job inexistente', () => {
            const { logger } = require('../utils/logger');
            failJob('id-inexistente-xyz', 'Erro de teste');
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('stopCleanupInterval', () => {
        it('deve parar o intervalo de limpeza sem lançar exceção', () => {
            expect(() => stopCleanupInterval()).not.toThrow();
        });

        it('deve ser idempotente (pode chamar múltiplas vezes)', () => {
            expect(() => {
                stopCleanupInterval();
                stopCleanupInterval();
            }).not.toThrow();
        });
    });
});
