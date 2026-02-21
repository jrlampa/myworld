/**
 * Testes unitários — AnalysisService
 *
 * Cobre: analyzeArea — sucesso, sem API key, resposta inválida, erro da API.
 * Usa mock do groq-sdk para isolamento total (zero custo, zero rede).
 */

import { AnalysisService } from '../services/analysisService';

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));

// Mock do Groq SDK
const mockCreate = jest.fn();

jest.mock('groq-sdk', () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: mockCreate
            }
        }
    }));
});

const TEST_STATS = {
    buildings: 10,
    roads: 5,
    trees: 3
};

const LOCATION = 'Muriaé, MG, Brasil';
const API_KEY = 'gsk_test_key_abc123';

describe('AnalysisService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('analyzeArea — sucesso com dados', () => {
        it('deve retornar análise em formato JSON quando Groq responde corretamente', async () => {
            mockCreate.mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: '{"analysis": "## Análise Urbana\\nA área possui boa densidade."}'
                    }
                }]
            });

            const result = await AnalysisService.analyzeArea(TEST_STATS, LOCATION, API_KEY);
            expect(result).toHaveProperty('analysis');
            expect(typeof result.analysis).toBe('string');
            expect(result.analysis).toContain('Análise Urbana');
        });

        it('deve logar info ao iniciar e completar requisição Groq', async () => {
            const { logger } = require('../utils/logger');
            mockCreate.mockResolvedValueOnce({
                choices: [{ message: { content: '{"analysis": "ok"}' } }]
            });

            await AnalysisService.analyzeArea(TEST_STATS, LOCATION, API_KEY);

            expect(logger.info).toHaveBeenCalledWith(
                'Requesting Groq AI analysis',
                expect.objectContaining({ locationName: LOCATION })
            );
            expect(logger.info).toHaveBeenCalledWith(
                'Groq AI analysis completed successfully'
            );
        });
    });

    describe('analyzeArea — sem dados OSM', () => {
        it('deve usar prompt alternativo quando não há dados', async () => {
            mockCreate.mockResolvedValueOnce({
                choices: [{ message: { content: '{"analysis": "Sem dados estruturais."}' } }]
            });

            const emptyStats = { buildings: 0, roads: 0, trees: 0 };
            const result = await AnalysisService.analyzeArea(emptyStats, LOCATION, API_KEY);
            expect(result).toHaveProperty('analysis');
        });
    });

    describe('analyzeArea — sem API key', () => {
        it('deve lançar erro quando API key é vazia', async () => {
            await expect(
                AnalysisService.analyzeArea(TEST_STATS, LOCATION, '')
            ).rejects.toThrow('GROQ_API_KEY is missing');
        });

        it('deve lançar erro quando API key é undefined', async () => {
            await expect(
                AnalysisService.analyzeArea(TEST_STATS, LOCATION, undefined as any)
            ).rejects.toThrow('GROQ_API_KEY is missing');
        });
    });

    describe('analyzeArea — resposta inválida do Groq', () => {
        it('deve retornar mensagem de erro quando resposta não é JSON válido', async () => {
            const { logger } = require('../utils/logger');
            mockCreate.mockResolvedValueOnce({
                choices: [{ message: { content: 'texto puro sem json' } }]
            });

            const result = await AnalysisService.analyzeArea(TEST_STATS, LOCATION, API_KEY);
            expect(result).toHaveProperty('analysis');
            expect(result.analysis).toContain('Erro');
            expect(logger.warn).toHaveBeenCalledWith(
                'Groq AI response format invalid',
                expect.any(Object)
            );
        });

        it('deve lidar com choices vazio retornando mensagem de erro', async () => {
            mockCreate.mockResolvedValueOnce({
                choices: [{ message: { content: '' } }]
            });

            const result = await AnalysisService.analyzeArea(TEST_STATS, LOCATION, API_KEY);
            expect(result).toHaveProperty('analysis');
        });
    });

    describe('analyzeArea — erro da API Groq', () => {
        it('deve retornar mensagem de erro sem lançar exceção quando API falha', async () => {
            const { logger } = require('../utils/logger');
            mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

            const result = await AnalysisService.analyzeArea(TEST_STATS, LOCATION, API_KEY);
            expect(result).toHaveProperty('analysis');
            expect(result.analysis).toContain('Erro na análise AI');
            expect(result.analysis).toContain('API rate limit exceeded');
            expect(logger.error).toHaveBeenCalledWith(
                'Groq AI analysis failed',
                expect.any(Object)
            );
        });

        it('deve incluir o nome da localização na mensagem de erro', async () => {
            mockCreate.mockRejectedValueOnce(new Error('timeout'));

            const result = await AnalysisService.analyzeArea(TEST_STATS, LOCATION, API_KEY);
            expect(result.analysis).toContain(LOCATION);
        });
    });
});
