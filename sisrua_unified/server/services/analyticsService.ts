/**
 * Analytics Service — Métricas de uso SaaS do sisRUA
 *
 * Responsabilidade única: rastrear e consultar métricas de uso.
 * Armazenamento em memória para agregação rápida; persistência em Firestore
 * em produção (USE_FIRESTORE=true ou NODE_ENV=production).
 * Zero custo, zero dependências externas adicionais.
 */

import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

export interface DxfExportEvent {
    timestamp: number;
    lat: number;
    lon: number;
    radius: number;
    mode: 'circle' | 'polygon';
    success: boolean;
    durationMs: number;
    isBatch: boolean;
    errorMessage?: string;
}

export interface AnalyticsSummary {
    totalExports: number;
    successfulExports: number;
    failedExports: number;
    successRate: number;
    avgDurationMs: number;
    avgRadius: number;
    batchExports: number;
    singleExports: number;
    exportsLast24h: number;
    exportsLast7d: number;
    exportsByHour: number[];   // índice 0–23
    exportsByMode: { circle: number; polygon: number };
    topRegions: RegionStat[];
    recentEvents: DxfExportEvent[];
}

export interface RegionStat {
    lat: number;
    lon: number;
    count: number;
    label: string;
}

// Janela de retenção de eventos (7 dias)
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 5000;
const TOP_REGIONS_COUNT = 5;
const REGION_CLUSTER_DEG = 0.05; // ~5 km
const COLLECTION_ANALYTICS = 'analytics_events';

// Usa Firestore em produção ou quando USE_FIRESTORE=true
const USE_FIRESTORE = process.env.NODE_ENV === 'production' || process.env.USE_FIRESTORE === 'true';

class AnalyticsService {
    private events: DxfExportEvent[] = [];

    /**
     * Registra um evento de exportação DXF.
     * Em produção, persiste assincronamente no Firestore.
     */
    record(event: DxfExportEvent): void {
        this.events.push(event);
        if (this.events.length > MAX_EVENTS) {
            this.events.shift();
        }
        if (USE_FIRESTORE) {
            this.persistToFirestore(event).catch(() => {
                // Erro já logado em persistToFirestore
            });
        }
    }

    /**
     * Persiste um evento no Firestore de forma assíncrona (fire-and-forget).
     * Usa circuit breaker do FirestoreService para proteção de quota.
     */
    private async persistToFirestore(event: DxfExportEvent): Promise<void> {
        try {
            const { getFirestoreService } = await import('./firestoreService.js');
            const svc = getFirestoreService();
            // ID único: timestamp + UUID v4 para garantir unicidade mesmo em alta concorrência
            const docId = `${event.timestamp}_${randomUUID()}`;
            await svc.safeWrite(COLLECTION_ANALYTICS, docId, event as Record<string, unknown>);
        } catch (err: any) {
            logger.warn('Analytics: falha ao persistir evento no Firestore', { error: err.message });
        }
    }

    /**
     * Carrega eventos recentes do Firestore para a memória.
     * Deve ser chamado uma vez na inicialização do servidor (produção).
     */
    async initFromFirestore(): Promise<void> {
        try {
            const { getFirestoreService } = await import('./firestoreService.js');
            const svc = getFirestoreService();
            const db = svc.getDb();
            const cutoff = Date.now() - RETENTION_MS;
            const snapshot = await db
                .collection(COLLECTION_ANALYTICS)
                .where('timestamp', '>=', cutoff)
                .orderBy('timestamp', 'asc')
                .limit(MAX_EVENTS)
                .get();
            this.events = snapshot.docs.map((doc) => doc.data() as DxfExportEvent);
            logger.info(`Analytics: ${this.events.length} eventos carregados do Firestore`);
        } catch (err: any) {
            logger.warn('Analytics: falha ao carregar eventos do Firestore (usando memória)', {
                error: err.message,
            });
        }
    }

    /**
     * Remove eventos antigos além da janela de retenção.
     */
    private prune(): void {
        const cutoff = Date.now() - RETENTION_MS;
        this.events = this.events.filter((e) => e.timestamp >= cutoff);
    }

    /**
     * Retorna o sumário de métricas de uso.
     */
    getSummary(): AnalyticsSummary {
        this.prune();

        const now = Date.now();
        const last24h = now - 24 * 60 * 60 * 1000;
        const last7d = now - RETENTION_MS;

        const total = this.events.length;
        const successful = this.events.filter((e) => e.success);
        const failed = this.events.filter((e) => !e.success);

        const totalDuration = successful.reduce((sum, e) => sum + e.durationMs, 0);
        const avgDuration = successful.length > 0 ? totalDuration / successful.length : 0;

        const totalRadius = this.events.reduce((sum, e) => sum + e.radius, 0);
        const avgRadius = total > 0 ? totalRadius / total : 0;

        const exportsByHour = Array(24).fill(0) as number[];
        this.events.forEach((e) => {
            const hour = new Date(e.timestamp).getHours();
            exportsByHour[hour]++;
        });

        const exportsLast24h = this.events.filter((e) => e.timestamp >= last24h).length;
        const exportsLast7d = this.events.filter((e) => e.timestamp >= last7d).length;

        const batchExports = this.events.filter((e) => e.isBatch).length;
        const singleExports = total - batchExports;

        const circleExports = this.events.filter((e) => e.mode === 'circle').length;
        const polygonExports = this.events.filter((e) => e.mode === 'polygon').length;

        const topRegions = this.computeTopRegions();
        const recentEvents = this.events.slice(-20).reverse();

        return {
            totalExports: total,
            successfulExports: successful.length,
            failedExports: failed.length,
            successRate: total > 0 ? (successful.length / total) * 100 : 0,
            avgDurationMs: Math.round(avgDuration),
            avgRadius: Math.round(avgRadius),
            batchExports,
            singleExports,
            exportsLast24h,
            exportsLast7d,
            exportsByHour,
            exportsByMode: { circle: circleExports, polygon: polygonExports },
            topRegions,
            recentEvents,
        };
    }

    /**
     * Agrupa exportações por região (cluster simples por grau decimal).
     */
    private computeTopRegions(): RegionStat[] {
        const clusters: Map<string, RegionStat> = new Map();

        this.events.forEach((e) => {
            const latKey = Math.round(e.lat / REGION_CLUSTER_DEG) * REGION_CLUSTER_DEG;
            const lonKey = Math.round(e.lon / REGION_CLUSTER_DEG) * REGION_CLUSTER_DEG;
            const key = `${latKey.toFixed(3)},${lonKey.toFixed(3)}`;

            if (clusters.has(key)) {
                clusters.get(key)!.count++;
            } else {
                clusters.set(key, {
                    lat: latKey,
                    lon: lonKey,
                    count: 1,
                    label: `${latKey.toFixed(3)}, ${lonKey.toFixed(3)}`,
                });
            }
        });

        return Array.from(clusters.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, TOP_REGIONS_COUNT);
    }

    /**
     * Retorna o número total de eventos retidos.
     */
    getEventCount(): number {
        return this.events.length;
    }

    /**
     * Limpa todos os eventos (útil em testes).
     */
    clear(): void {
        this.events = [];
    }
}

// Singleton
const analyticsService = new AnalyticsService();

/**
 * Inicializa o serviço de analytics carregando eventos do Firestore.
 * Deve ser chamado uma vez na inicialização do servidor em produção.
 */
export async function initAnalyticsFromFirestore(): Promise<void> {
    if (USE_FIRESTORE) {
        await analyticsService.initFromFirestore();
    }
}

export default analyticsService;
export { AnalyticsService };
