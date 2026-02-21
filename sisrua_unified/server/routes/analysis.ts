import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { GeocodingService } from '../services/geocodingService.js';
import { ElevationService } from '../services/elevationService.js';
import { AnalysisService } from '../services/analysisService.js';
import {
    searchSchema,
    elevationProfileSchema,
    analysisSchema
} from '../schemas/apiSchemas.js';
import express from 'express';

const router = Router();
const MAX_ERROR_MESSAGE_LENGTH = 200;

const smallBodyParser = express.json({ limit: '100kb' });

/**
 * POST /api/search
 * Busca de coordenadas por endereço (GeocodingService).
 */
router.post('/api/search', smallBodyParser, async (req: Request, res: Response) => {
    try {
        const validation = searchSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Validação de busca falhou', { issues: validation.error.issues, ip: req.ip });
            return res.status(400).json({
                error: 'Requisição inválida',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { query } = validation.data;
        const location = await GeocodingService.resolveLocation(query);

        if (location) {
            return res.json(location);
        } else {
            return res.status(404).json({ error: 'Localização não encontrada' });
        }
    } catch (error: any) {
        logger.error('Erro na busca', { error });
        return res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/elevation/profile
 * Perfil de elevação entre dois pontos (ElevationService).
 */
router.post('/api/elevation/profile', async (req: Request, res: Response) => {
    try {
        const validation = elevationProfileSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Validação do perfil de elevação falhou', { issues: validation.error.issues, ip: req.ip });
            return res.status(400).json({
                error: 'Requisição inválida',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { start, end, steps } = validation.data;
        logger.info('Buscando perfil de elevação', { start, end, steps });
        const profile = await ElevationService.getElevationProfile(start, end, steps);
        return res.json({ profile });
    } catch (error: any) {
        logger.error('Erro no perfil de elevação', { error: error.message, stack: error.stack });
        return res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/analyze
 * Análise AI da área via GROQ (AnalysisService).
 */
router.post('/api/analyze', smallBodyParser, async (req: Request, res: Response) => {
    try {
        const validation = analysisSchema.safeParse(req.body);
        if (!validation.success) {
            logger.warn('Validação de análise falhou', { issues: validation.error.issues, ip: req.ip });
            return res.status(400).json({
                error: 'Requisição inválida',
                details: validation.error.issues.map(i => i.message).join(', ')
            });
        }

        const { stats, locationName } = validation.data;
        const apiKey = process.env.GROQ_API_KEY;
        const location = locationName || 'Área Selecionada';

        logger.info('Análise GROQ solicitada', { locationName: location, hasApiKey: !!apiKey, timestamp: new Date().toISOString() });

        if (!apiKey) {
            logger.warn('Análise solicitada sem GROQ_API_KEY configurada');
            return res.status(503).json({
                error: 'GROQ_API_KEY não configurada',
                message: 'Análise AI indisponível. Configure GROQ_API_KEY no arquivo .env.',
                analysis: '**Análise AI Indisponível**\n\nPara habilitar análises inteligentes com IA, configure a variável `GROQ_API_KEY` no arquivo `.env`.\n\nObtenha sua chave gratuita em: https://console.groq.com/keys'
            });
        }

        const result = await AnalysisService.analyzeArea(stats, location, apiKey!);
        logger.info('Análise AI concluída', { locationName: location });
        return res.json(result);
    } catch (error: any) {
        logger.error('Erro na análise', {
            error: error.message,
            stack: error.stack,
            isRateLimitError: error.message?.includes('rate limit') || error.message?.includes('429'),
            isAuthError: error.message?.includes('401') || error.message?.includes('unauthorized'),
            isNetworkError: error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')
        });

        const sanitizedMessage = String(error.message || 'Erro desconhecido').slice(0, MAX_ERROR_MESSAGE_LENGTH);
        let userMessage = '**Erro na Análise AI**\n\nNão foi possível processar a análise. Por favor, tente novamente.';

        if (error.message?.includes('rate limit') || error.message?.includes('429')) {
            userMessage = '**Limite de Taxa Excedido**\n\nMuitas requisições à API Groq. Por favor, aguarde alguns momentos e tente novamente.';
        } else if (error.message?.includes('401') || error.message?.includes('unauthorized') || error.message?.includes('invalid api key')) {
            userMessage = '**Erro de Autenticação**\n\nA chave GROQ_API_KEY parece estar inválida. Verifique a configuração no Cloud Run.';
        } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
            userMessage = '**Erro de Conexão**\n\nNão foi possível conectar à API Groq. Verifique a conectividade de rede.';
        }

        return res.status(500).json({
            error: 'Falha na análise',
            details: sanitizedMessage,
            analysis: userMessage
        });
    }
});

export default router;
