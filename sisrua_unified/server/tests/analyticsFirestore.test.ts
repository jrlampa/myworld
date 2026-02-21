/**
 * Testes unitários — AnalyticsService: persistência Firestore
 *
 * Cobre: initFromFirestore, persistToFirestore (via record com USE_FIRESTORE).
 * Usa mocks para isolar o Firestore sem custo/rede real.
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

// ─── Mock do FirestoreService ─────────────────────────────────────────────────

const mockSafeWrite = jest.fn().mockResolvedValue(undefined);
const mockGetDb = jest.fn();

jest.mock('../services/firestoreService.js', () => ({
    getFirestoreService: () => ({
        safeWrite: mockSafeWrite,
        getDb: mockGetDb,
    }),
}));

describe('AnalyticsService — persistência Firestore', () => {
    let svc: AnalyticsService;

    beforeEach(() => {
        svc = new AnalyticsService();
        jest.clearAllMocks();
    });

    describe('initFromFirestore', () => {
        it('deve carregar eventos do Firestore para memória', async () => {
            const events: DxfExportEvent[] = [
                makeEvent({ timestamp: Date.now() - 1000 }),
                makeEvent({ timestamp: Date.now() - 2000 }),
            ];

            const mockGet = jest.fn().mockResolvedValue({
                docs: events.map((e) => ({ data: () => e })),
            });
            const mockOrderBy = jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ get: mockGet }) });
            const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
            const mockCollection = jest.fn().mockReturnValue({ where: mockWhere });

            mockGetDb.mockReturnValue({ collection: mockCollection });

            await svc.initFromFirestore();

            expect(svc.getEventCount()).toBe(2);
            expect(mockCollection).toHaveBeenCalledWith('analytics_events');
            expect(mockWhere).toHaveBeenCalledWith('timestamp', '>=', expect.any(Number));
        });

        it('deve usar memória vazia quando Firestore falha', async () => {
            mockGetDb.mockReturnValue({
                collection: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({
                        orderBy: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                get: jest.fn().mockRejectedValue(new Error('Firestore indisponível')),
                            }),
                        }),
                    }),
                }),
            });

            await expect(svc.initFromFirestore()).resolves.not.toThrow();
            expect(svc.getEventCount()).toBe(0);
        });

        it('deve limitar a MAX_EVENTS eventos carregados', async () => {
            const mockGet = jest.fn().mockResolvedValue({ docs: [] });
            const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
            const mockOrderBy = jest.fn().mockReturnValue({ limit: mockLimit });
            const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
            mockGetDb.mockReturnValue({ collection: jest.fn().mockReturnValue({ where: mockWhere }) });

            await svc.initFromFirestore();

            // limit(5000) deve ser chamado
            expect(mockLimit).toHaveBeenCalledWith(5000);
        });
    });

    describe('record — com USE_FIRESTORE simulado', () => {
        it('deve chamar safeWrite ao registrar evento com Firestore ativo', async () => {
            // Simulamos USE_FIRESTORE via mock: chamamos persistToFirestore diretamente
            // através do record() e verificamos que safeWrite é chamado
            const event = makeEvent();

            // Forçar persistência: chamamos o método privado via cast
            await (svc as any).persistToFirestore(event);

            expect(mockSafeWrite).toHaveBeenCalledTimes(1);
            expect(mockSafeWrite).toHaveBeenCalledWith(
                'analytics_events',
                expect.stringMatching(/^\d+_[0-9a-f-]{36}$/i),
                event
            );
        });

        it('deve não lançar erro quando safeWrite falha', async () => {
            mockSafeWrite.mockRejectedValueOnce(new Error('Circuit breaker open'));

            const event = makeEvent();
            await expect((svc as any).persistToFirestore(event)).resolves.not.toThrow();
        });

        it('deve gerar ID único com timestamp + UUID v4', async () => {
            const event = makeEvent({ timestamp: 1700000000000 });
            await (svc as any).persistToFirestore(event);

            const docId = mockSafeWrite.mock.calls[0][1] as string;
            // Formato: <timestamp>_<uuid-v4>
            expect(docId).toMatch(
                /^1700000000000_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
        });

        it('deve gerar IDs únicos mesmo com o mesmo timestamp (sem colisões)', async () => {
            const now = Date.now();
            const event = makeEvent({ timestamp: now });

            await (svc as any).persistToFirestore(event);
            await (svc as any).persistToFirestore(event);

            const id1 = mockSafeWrite.mock.calls[0][1] as string;
            const id2 = mockSafeWrite.mock.calls[1][1] as string;
            expect(id1).not.toBe(id2);
        });
    });

    describe('initAnalyticsFromFirestore — função exportada', () => {
        it('deve ser uma função assíncrona', async () => {
            const { initAnalyticsFromFirestore } = await import('../services/analyticsService');
            expect(typeof initAnalyticsFromFirestore).toBe('function');
            // Em ambiente de teste (NODE_ENV=test), não chama Firestore
            await expect(initAnalyticsFromFirestore()).resolves.not.toThrow();
        });
    });
});
