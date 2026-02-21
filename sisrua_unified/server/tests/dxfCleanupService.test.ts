/**
 * Testes unitários — DxfCleanupService
 *
 * Cobre: scheduleDxfDeletion, triggerCleanupNow, stopDxfCleanup
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
    scheduleDxfDeletion,
    triggerCleanupNow,
    stopDxfCleanup
} from '../services/dxfCleanupService';

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

function makeTempDxf(): string {
    const filePath = path.join(os.tmpdir(), `test_${Date.now()}_${Math.random()}.dxf`);
    fs.writeFileSync(filePath, 'DXF content');
    return filePath;
}

afterAll(() => {
    stopDxfCleanup();
});

describe('DxfCleanupService', () => {
    describe('scheduleDxfDeletion', () => {
        it('deve agendar um arquivo para deleção sem lançar exceção', () => {
            const filePath = makeTempDxf();
            expect(() => scheduleDxfDeletion(filePath)).not.toThrow();
            // Limpa o arquivo para não deixar lixo no sistema
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        it('deve aceitar múltiplos arquivos agendados', () => {
            const files = [makeTempDxf(), makeTempDxf()];
            files.forEach(f => expect(() => scheduleDxfDeletion(f)).not.toThrow());
            files.forEach(f => { if (fs.existsSync(f)) fs.unlinkSync(f); });
        });
    });

// TTL padrão em ms: 1 hora (conforme DEFAULT_TTL_PROD em dxfCleanupService.ts)
// Avança 62 minutos para garantir expiração do arquivo agendado
const PAST_TTL_MS = 62 * 60 * 1000;

    describe('triggerCleanupNow', () => {
        it('deve deletar arquivo cujo deleteAt já passou', () => {
            const filePath = makeTempDxf();
            scheduleDxfDeletion(filePath);

            // Avança o relógio para além do TTL (62 min > 60 min de produção)
            const future = Date.now() + PAST_TTL_MS;
            jest.spyOn(Date, 'now').mockReturnValue(future);

            triggerCleanupNow();

            jest.spyOn(Date, 'now').mockRestore();

            // Arquivo deve ter sido deletado
            expect(fs.existsSync(filePath)).toBe(false);
        });

        it('não deve lançar exceção quando não há arquivos agendados', () => {
            expect(() => triggerCleanupNow()).not.toThrow();
        });

        it('deve logar aviso quando arquivo não existe ao tentar deletar', () => {
            const { logger } = require('../utils/logger');
            const nonExistentPath = path.join(os.tmpdir(), 'nonexistent_abc123.dxf');
            scheduleDxfDeletion(nonExistentPath);

            const future = Date.now() + PAST_TTL_MS;
            jest.spyOn(Date, 'now').mockReturnValue(future);

            triggerCleanupNow();

            jest.spyOn(Date, 'now').mockRestore();

            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('DXF file already deleted'),
                expect.any(Object)
            );
        });

        it('deve logar erro quando falha ao deletar arquivo', () => {
            const { logger } = require('../utils/logger');
            const filePath = makeTempDxf();
            scheduleDxfDeletion(filePath);

            // Mocka fs.unlinkSync para lançar erro
            const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
                throw new Error('permission denied');
            });

            const future = Date.now() + PAST_TTL_MS;
            jest.spyOn(Date, 'now').mockReturnValue(future);

            triggerCleanupNow();

            jest.spyOn(Date, 'now').mockRestore();
            unlinkSpy.mockRestore();

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to delete DXF file'),
                expect.any(Object)
            );

            // Limpa o arquivo real
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
    });

    describe('stopDxfCleanup', () => {
        it('deve parar o intervalo sem lançar exceção', () => {
            expect(() => stopDxfCleanup()).not.toThrow();
        });

        it('deve ser idempotente (pode chamar múltiplas vezes)', () => {
            expect(() => {
                stopDxfCleanup();
                stopDxfCleanup();
            }).not.toThrow();
        });
    });
});
