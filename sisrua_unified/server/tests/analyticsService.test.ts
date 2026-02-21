/**
 * Testes unitários — AnalyticsService
 *
 * Cobre: record, getSummary, computeTopRegions, prune, clear.
 */

import { AnalyticsService, DxfExportEvent } from '../services/analyticsService';

function makeEvent(overrides: Partial<DxfExportEvent> = {}): DxfExportEvent {
    return {
        timestamp: Date.now(),
        lat: -22.15018,
        lon: -42.92185,
        radius: 500,
        mode: 'circle',
        success: true,
        durationMs: 1200,
        isBatch: false,
        ...overrides,
    };
}

describe('AnalyticsService', () => {
    let svc: AnalyticsService;

    beforeEach(() => {
        svc = new AnalyticsService();
    });

    describe('record & getSummary — estado vazio', () => {
        it('deve retornar sumário zerado sem eventos', () => {
            const s = svc.getSummary();
            expect(s.totalExports).toBe(0);
            expect(s.successfulExports).toBe(0);
            expect(s.failedExports).toBe(0);
            expect(s.successRate).toBe(0);
            expect(s.avgDurationMs).toBe(0);
            expect(s.avgRadius).toBe(0);
            expect(s.batchExports).toBe(0);
            expect(s.singleExports).toBe(0);
            expect(s.exportsLast24h).toBe(0);
            expect(s.exportsLast7d).toBe(0);
            expect(s.exportsByHour).toHaveLength(24);
            expect(s.exportsByMode).toEqual({ circle: 0, polygon: 0 });
            expect(s.topRegions).toHaveLength(0);
            expect(s.recentEvents).toHaveLength(0);
        });
    });

    describe('record — evento único de sucesso', () => {
        it('deve contabilizar um evento com sucesso', () => {
            svc.record(makeEvent({ durationMs: 2000, radius: 500 }));
            const s = svc.getSummary();
            expect(s.totalExports).toBe(1);
            expect(s.successfulExports).toBe(1);
            expect(s.failedExports).toBe(0);
            expect(s.successRate).toBeCloseTo(100);
            expect(s.avgDurationMs).toBe(2000);
            expect(s.avgRadius).toBe(500);
        });
    });

    describe('record — evento de falha', () => {
        it('deve contabilizar eventos com falha', () => {
            svc.record(makeEvent({ success: false, errorMessage: 'timeout' }));
            const s = svc.getSummary();
            expect(s.failedExports).toBe(1);
            expect(s.successfulExports).toBe(0);
            expect(s.successRate).toBe(0);
            expect(s.avgDurationMs).toBe(0); // só calcula para sucesso
        });
    });

    describe('batchExports vs singleExports', () => {
        it('deve distinguir exportações em lote e individuais', () => {
            svc.record(makeEvent({ isBatch: true }));
            svc.record(makeEvent({ isBatch: false }));
            svc.record(makeEvent({ isBatch: false }));
            const s = svc.getSummary();
            expect(s.batchExports).toBe(1);
            expect(s.singleExports).toBe(2);
        });
    });

    describe('exportsByMode — circle vs polygon', () => {
        it('deve contabilizar exportações por modo', () => {
            svc.record(makeEvent({ mode: 'circle' }));
            svc.record(makeEvent({ mode: 'polygon' }));
            svc.record(makeEvent({ mode: 'circle' }));
            const s = svc.getSummary();
            expect(s.exportsByMode.circle).toBe(2);
            expect(s.exportsByMode.polygon).toBe(1);
        });

        it('deve retornar zeros quando não há eventos', () => {
            const s = svc.getSummary();
            expect(s.exportsByMode).toEqual({ circle: 0, polygon: 0 });
        });
    });

    describe('exportsLast24h', () => {
        it('deve contar somente eventos das últimas 24h', () => {
            const old = Date.now() - 25 * 60 * 60 * 1000; // 25 horas atrás
            svc.record(makeEvent({ timestamp: old }));
            svc.record(makeEvent()); // agora
            const s = svc.getSummary();
            expect(s.exportsLast24h).toBe(1);
        });
    });

    describe('exportsByHour', () => {
        it('deve acumular exportações pelo índice da hora', () => {
            const now = new Date();
            const hour = now.getHours();
            svc.record(makeEvent({ timestamp: now.getTime() }));
            svc.record(makeEvent({ timestamp: now.getTime() }));
            const s = svc.getSummary();
            expect(s.exportsByHour[hour]).toBe(2);
        });
    });

    describe('topRegions', () => {
        it('deve agrupar eventos por cluster de região', () => {
            // Mesma região (dentro de 0.05 grau de diferença)
            svc.record(makeEvent({ lat: -22.15, lon: -42.92 }));
            svc.record(makeEvent({ lat: -22.15, lon: -42.92 }));
            // Região diferente
            svc.record(makeEvent({ lat: -23.00, lon: -43.00 }));
            const s = svc.getSummary();
            expect(s.topRegions.length).toBeGreaterThan(0);
            expect(s.topRegions[0].count).toBeGreaterThanOrEqual(2);
        });

        it('deve limitar a 5 regiões no máximo', () => {
            for (let i = 0; i < 10; i++) {
                svc.record(makeEvent({ lat: -22 + i * 0.5, lon: -43 + i * 0.5 }));
            }
            const s = svc.getSummary();
            expect(s.topRegions.length).toBeLessThanOrEqual(5);
        });
    });

    describe('recentEvents', () => {
        it('deve retornar no máximo 20 eventos recentes em ordem inversa', () => {
            for (let i = 0; i < 25; i++) {
                svc.record(makeEvent({ timestamp: Date.now() + i }));
            }
            const s = svc.getSummary();
            expect(s.recentEvents.length).toBe(20);
            // Deve estar em ordem decrescente (mais recente primeiro)
            expect(s.recentEvents[0].timestamp).toBeGreaterThanOrEqual(s.recentEvents[1].timestamp);
        });
    });

    describe('prune — retenção de 7 dias', () => {
        it('deve descartar eventos com mais de 7 dias', () => {
            const veryOld = Date.now() - 8 * 24 * 60 * 60 * 1000;
            svc.record(makeEvent({ timestamp: veryOld }));
            svc.record(makeEvent()); // recente
            const s = svc.getSummary();
            expect(s.totalExports).toBe(1);
        });
    });

    describe('clear', () => {
        it('deve limpar todos os eventos', () => {
            svc.record(makeEvent());
            svc.record(makeEvent());
            svc.clear();
            expect(svc.getEventCount()).toBe(0);
            const s = svc.getSummary();
            expect(s.totalExports).toBe(0);
        });
    });

    describe('getEventCount', () => {
        it('deve retornar o número correto de eventos retidos', () => {
            svc.record(makeEvent());
            svc.record(makeEvent());
            expect(svc.getEventCount()).toBe(2);
        });
    });

    describe('avgDurationMs — múltiplos eventos de sucesso', () => {
        it('deve calcular a média correta de duração', () => {
            svc.record(makeEvent({ success: true, durationMs: 1000 }));
            svc.record(makeEvent({ success: true, durationMs: 3000 }));
            const s = svc.getSummary();
            expect(s.avgDurationMs).toBe(2000);
        });
    });

    describe('avgRadius — múltiplos eventos', () => {
        it('deve calcular a média correta de raio', () => {
            svc.record(makeEvent({ radius: 100 }));
            svc.record(makeEvent({ radius: 900 }));
            const s = svc.getSummary();
            expect(s.avgRadius).toBe(500);
        });
    });
});
