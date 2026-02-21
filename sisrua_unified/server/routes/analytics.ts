/**
 * Rota de Analytics — Métricas de uso SaaS do sisRUA
 *
 * GET /api/analytics        → sumário de métricas
 * GET /api/analytics/events → eventos recentes (últimos 20)
 */

import { Router, Request, Response } from 'express';
import analyticsService from '../services/analyticsService.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/analytics
 * Retorna o sumário completo de métricas de uso.
 */
router.get('/api/analytics', (_req: Request, res: Response) => {
    try {
        const summary = analyticsService.getSummary();
        res.json({ status: 'ok', data: summary });
    } catch (err: any) {
        logger.error('Erro ao recuperar analytics', { error: err });
        res.status(500).json({ error: 'Falha ao recuperar métricas', details: err.message });
    }
});

/**
 * GET /api/analytics/events
 * Retorna os últimos 20 eventos registrados.
 */
router.get('/api/analytics/events', (_req: Request, res: Response) => {
    try {
        const summary = analyticsService.getSummary();
        res.json({ status: 'ok', data: summary.recentEvents });
    } catch (err: any) {
        logger.error('Erro ao recuperar eventos de analytics', { error: err });
        res.status(500).json({ error: 'Falha ao recuperar eventos', details: err.message });
    }
});

export default router;
