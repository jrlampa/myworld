
import { Router, Request, Response } from 'express';
import { generateDXF } from '../services/dxfService';
import { generateGeoJSON } from '../services/geojsonService';
import { jobManager } from '../utils/jobManager';

const router = Router();

// --- DXF Generation Routes ---

// 1. Start Job
router.post('/dxf/start', (req: Request, res: Response) => {
  try {
    const { elements, center, terrain, options } = req.body;

    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ error: 'Dados OSM inválidos ou vazios.' });
    }
    if (!center || !center.lat || !center.lng) {
      return res.status(400).json({ error: 'Centro do mapa inválido.' });
    }

    const jobId = jobManager.createJob();
    console.log(`[DXF] Job Iniciado: ${jobId} para ${elements.length} elementos.`);

    // Start Async Processing
    // Fix: Using setTimeout as a replacement for setImmediate to ensure the job runs asynchronously
    setTimeout(async () => {
      try {
        const onProgress = (pct: number, msg: string) => {
           jobManager.updateProgress(jobId, pct, msg);
        };

        // Call the heavy service (now async with chunks)
        const dxfString = await generateDXF(elements, center, terrain, options || {}, onProgress);
        
        jobManager.completeJob(jobId, dxfString);
      } catch (err: any) {
        console.error(`[DXF] Job Error ${jobId}:`, err);
        jobManager.failJob(jobId, err.message || "Erro interno na geração do DXF.");
      }
    }, 0);

    res.json({ jobId });
  } catch (e) {
    res.status(500).json({ error: 'Falha ao iniciar o job.' });
  }
});

// 2. Stream Progress (SSE)
router.get('/dxf/progress/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job não encontrado.' });
  }

  // SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendUpdate = () => {
    const currentJob = jobManager.getJob(jobId);
    if (!currentJob) {
      res.write(`data: ${JSON.stringify({ status: 'failed', error: 'Job perdido/expirado.' })}\n\n`);
      return res.end();
    }

    const payload = {
      status: currentJob.status,
      progress: currentJob.progress,
      message: currentJob.message,
      error: currentJob.error
    };

    res.write(`data: ${JSON.stringify(payload)}\n\n`);

    if (currentJob.status === 'completed' || currentJob.status === 'failed') {
      res.end();
      clearInterval(interval);
    }
  };

  const interval = setInterval(sendUpdate, 500); // Poll internal state every 500ms
  sendUpdate(); // Immediate update

  req.on('close', () => {
    clearInterval(interval);
  });
});

// 3. Download
router.get('/dxf/download/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job || job.status !== 'completed') {
    return res.status(404).json({ error: 'Job não está pronto ou não existe.' });
  }

  res.setHeader('Content-Type', 'application/dxf');
  res.setHeader('Content-Disposition', `attachment; filename=export_${jobId.substring(0,6)}.dxf`);
  res.send(job.result);
});

// --- GeoJSON Direct Route (Lighter, sync) ---
router.post('/geojson', (req: Request, res: Response) => {
  try {
    const { elements, options } = req.body;
    if (!elements) return res.status(400).json({error: "Faltando elementos"});
    
    console.log(`[GeoJSON] Gerando para ${elements.length} elementos...`);
    const jsonString = generateGeoJSON(elements, options.layers);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=export.geojson`);
    res.send(jsonString);
  } catch (err) {
    console.error("GeoJSON Error:", err);
    res.status(500).json({ error: "Falha ao gerar GeoJSON" });
  }
});

export default router;
