/**
 * Analytics Service — cliente frontend
 * Responsabilidade única: buscar métricas de uso da API do backend.
 */

import { API_BASE_URL } from '../config/api';

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
    exportsByHour: number[];
    topRegions: RegionStat[];
    recentEvents: ExportEvent[];
}

export interface RegionStat {
    lat: number;
    lon: number;
    count: number;
    label: string;
}

export interface ExportEvent {
    timestamp: number;
    lat: number;
    lon: number;
    radius: number;
    mode: string;
    success: boolean;
    durationMs: number;
    isBatch: boolean;
    errorMessage?: string;
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
    const res = await fetch(`${API_BASE_URL}/analytics`);
    if (!res.ok) throw new Error(`Erro ao buscar métricas: ${res.status}`);
    const json = await res.json();
    return json.data as AnalyticsSummary;
}
