import { Router } from 'express';
import { JobManager } from '../services/jobManager';
import { validateOsmParams } from '../utils/validation';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();
const jobManager = new JobManager();

// POST /api/dxf/start
router.post('/start', (req, res) => {
  const params = req.body;
  const validation = validateOsmParams(params);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const jobId = jobManager.createJob(params);

  const pythonPath = path.join(process.cwd(), 'venv', 'Scripts', 'python.exe');
  const scriptPath = path.join(process.cwd(), 'py_engine', 'main.py');

  jobManager.enqueueJob(jobId, params, pythonPath, scriptPath);

  res.json({ jobId });
});

// GET /api/dxf/progress/:jobId
router.get('/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendUpdate = () => {
    const currentJob = jobManager.getJob(jobId);
    if (!currentJob) return;

    res.write(`data: ${JSON.stringify({
      status: currentJob.status,
      progress: currentJob.progress,
      message: currentJob.message
    })}\n\n`);

    if (currentJob.status === 'completed' || currentJob.status === 'error') {
      clearInterval(interval);
      res.end();
    }
  };

  const interval = setInterval(sendUpdate, 1000);
  sendUpdate();

  req.on('close', () => {
    clearInterval(interval);
  });
});

// GET /api/dxf/download/:jobId
router.get('/download/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobManager.getJob(jobId);

  if (!job || job.status !== 'completed' || !job.outputFile) {
    return res.status(400).json({ error: 'Job not ready or not found' });
  }

  if (fs.existsSync(job.outputFile)) {
    res.download(job.outputFile);
  } else {
    res.status(404).json({ error: 'File not found on disk' });
  }
});

export default router;
