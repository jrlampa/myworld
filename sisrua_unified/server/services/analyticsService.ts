/**
 * Analytics Service — Métricas de uso SaaS do sisRUA
 *
 * Responsabilidade única: rastrear e consultar métricas de uso.
 * Armazenamento em memória (dev) — extensível para Firestore em produção.
 * Zero custo, zero dependências externas.
 */

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

class AnalyticsService {
    private events: DxfExportEvent[] = [];

    /**
     * Registra um evento de exportação DXF.
     */
    record(event: DxfExportEvent): void {
        this.events.push(event);
        if (this.events.length > MAX_EVENTS) {
            this.events.shift();
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

export default analyticsService;
export { AnalyticsService };
