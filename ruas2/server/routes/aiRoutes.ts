
import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// Helper
const getAIClient = () => {
  if (!process.env.API_KEY) throw new Error("API_KEY não configurada no servidor.");
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { stats, locationName } = req.body;
    
    // Fail fast if no API key
    if (!process.env.API_KEY) {
       return res.json({ analysis: "Servidor: API Key do Gemini não configurada. Análise indisponível." });
    }

    const ai = getAIClient();
    const prompt = `
      Você é um engenheiro civil sênior especialista em planejamento urbano.
      Analise os seguintes dados estatísticos extraídos do OpenStreetMap para a área de "${locationName}".
      
      Dados: ${JSON.stringify(stats)}
      
      Forneça um resumo executivo de 2 ou 3 frases sobre a densidade, tipologia e possíveis desafios de infraestrutura desta área. 
      Se houver 'violations' (erros de geometria/dados), mencione a gravidade.
      Responda em Português do Brasil, tom profissional.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    res.json({ analysis: response.text });
  } catch (err: any) {
    console.error("[AI] Analyze Error:", err);
    res.status(500).json({ error: "Falha na análise de IA." });
  }
});

router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!process.env.API_KEY) return res.status(503).json({ error: "AI Search Unavailable" });

    const ai = getAIClient();
    const prompt = `
      Identifique as coordenadas de latitude e longitude precisas para a busca: "${query}".
      Retorne APENAS um JSON estrito no formato: { "lat": number, "lng": number, "label": "Nome Formatado, País" }.
      Se não encontrar, retorne um JSON com campos nulos.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(response.text || '{}');
    if (!data.lat || !data.lng) {
        return res.status(404).json({ error: "Local não encontrado via IA." });
    }
    
    res.json(data);
  } catch (err) {
    console.error("[AI] Search Error:", err);
    res.status(500).json({ error: "Falha na busca inteligente." });
  }
});

export default router;
