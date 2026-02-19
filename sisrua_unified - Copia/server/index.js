const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
app.use(express.json({ limit: '2mb' }));

const repoRoot = path.resolve(__dirname, '..');
const pyEntry = path.join(repoRoot, 'py_engine', 'main.py');
const stateDir = path.join(repoRoot, 'server', 'data');
const stateFile = path.join(stateDir, 'topography-state.json');

const MAX_JOB_AGE_HOURS = Number(process.env.TOPOGRAPHY_JOB_RETENTION_HOURS || 24);
const MAX_JOB_KEEP = Number(process.env.TOPOGRAPHY_MAX_JOBS || 200);
const CLEANUP_INTERVAL_MS = Number(process.env.TOPOGRAPHY_CLEANUP_INTERVAL_MS || 10 * 60 * 1000);
const MAX_CONCURRENT_JOBS = Number(process.env.TOPOGRAPHY_MAX_CONCURRENT_JOBS || 2);

const runtimeConfig = {
  providerMode: 'premium-first',
  qualityMode: 'high',
  autoDiagnostics: true,
};

const jobStore = new Map();
const runningProcesses = new Map();
let activeJobCount = 0;

const metrics = {
  startedAt: new Date().toISOString(),
  jobsCreated: 0,
  jobsCompleted: 0,
  jobsFailed: 0,
  requestCount: 0,
  totalDurationMs: 0,
  providerUsage: {
    mapbox: 0,
    opentopodata: 0,
    'open-elevation': 0,
    'fallback-zero': 0,
  },
  qualityUsage: {
    balanced: 0,
    high: 0,
    ultra: 0,
  },
};

function ensureStateDir() {
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }
}

function serializeJob(job) {
  return {
    id: job.id,
    status: job.status,
    payload: job.payload,
    outputPath: job.outputPath,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    elapsedMs: job.elapsedMs,
    result: job.result,
    error: job.error,
    downloadUrl: job.downloadUrl,
  };
}

function persistState() {
  try {
    ensureStateDir();
    const jobs = Array.from(jobStore.values()).map(serializeJob);
    const payload = {
      runtimeConfig,
      metrics,
      jobs,
      persistedAt: nowIso(),
    };
    fs.writeFileSync(stateFile, JSON.stringify(payload, null, 2), 'utf8');
  } catch (_) {
  }
}

function loadState() {
  try {
    if (!fs.existsSync(stateFile)) {
      return;
    }
    const raw = fs.readFileSync(stateFile, 'utf8');
    const data = JSON.parse(raw);

    if (data.runtimeConfig && typeof data.runtimeConfig === 'object') {
      if (typeof data.runtimeConfig.providerMode === 'string') runtimeConfig.providerMode = data.runtimeConfig.providerMode;
      if (typeof data.runtimeConfig.qualityMode === 'string') runtimeConfig.qualityMode = data.runtimeConfig.qualityMode;
      if (typeof data.runtimeConfig.autoDiagnostics === 'boolean') runtimeConfig.autoDiagnostics = data.runtimeConfig.autoDiagnostics;
    }

    if (data.metrics && typeof data.metrics === 'object') {
      Object.assign(metrics, data.metrics);
    }

    if (Array.isArray(data.jobs)) {
      data.jobs.forEach((job) => {
        if (!job?.id) return;
        if (job.status === 'running' || job.status === 'queued') {
          job.status = 'failed';
          job.error = 'Recovered after restart before completion';
          job.finishedAt = nowIso();
        }
        jobStore.set(job.id, job);
      });
    }
  } catch (_) {
  }
}

function getStorageStats() {
  const jobs = Array.from(jobStore.values());
  const files = jobs.filter((j) => j.outputPath && fs.existsSync(j.outputPath));
  const totalBytes = files.reduce((sum, j) => {
    try {
      return sum + fs.statSync(j.outputPath).size;
    } catch (_) {
      return sum;
    }
  }, 0);
  return {
    jobsInMemory: jobs.length,
    filesOnDisk: files.length,
    totalBytes,
  };
}

function cleanupArtifacts() {
  const removedFiles = [];
  const removedJobs = [];

  const jobs = Array.from(jobStore.values()).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const now = Date.now();
  const maxAgeMs = Math.max(1, MAX_JOB_AGE_HOURS) * 60 * 60 * 1000;

  jobs.forEach((job) => {
    const createdAtMs = Date.parse(job.createdAt || '') || now;
    const expired = now - createdAtMs > maxAgeMs;
    const overCount = jobStore.size - removedJobs.length > MAX_JOB_KEEP;

    if (!expired && !overCount) {
      return;
    }

    if (job.outputPath && fs.existsSync(job.outputPath)) {
      try {
        fs.unlinkSync(job.outputPath);
        removedFiles.push(path.basename(job.outputPath));
      } catch (_) {
      }
    }

    jobStore.delete(job.id);
    removedJobs.push(job.id);
  });

  if (removedJobs.length > 0 || removedFiles.length > 0) {
    persistState();
  }

  return {
    removedJobs,
    removedFiles,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function makeJobId() {
  return `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

function ensureQualityBucket(qualityMode) {
  if (!metrics.qualityUsage[qualityMode]) {
    metrics.qualityUsage[qualityMode] = 0;
  }
}

function accumulateMetrics(result, elapsedMs) {
  metrics.requestCount += 1;
  metrics.totalDurationMs += elapsedMs;

  const qualityMode = result?.metadata?.quality_mode || 'high';
  ensureQualityBucket(qualityMode);
  metrics.qualityUsage[qualityMode] += 1;

  const providers = result?.metadata?.providers_used || [];
  providers.forEach((provider) => {
    if (!metrics.providerUsage[provider]) {
      metrics.providerUsage[provider] = 0;
    }
    metrics.providerUsage[provider] += 1;
  });
}

function getMetricsSnapshot() {
  const avgDurationMs = metrics.requestCount > 0 ? metrics.totalDurationMs / metrics.requestCount : 0;
  const queueDepth = Array.from(jobStore.values()).filter((job) => job.status === 'queued').length;
  return {
    ...metrics,
    avgDurationMs: Number(avgDurationMs.toFixed(2)),
    activeJobs: Array.from(jobStore.values()).filter((job) => job.status === 'running' || job.status === 'queued').length,
    queueDepth,
    maxConcurrentJobs: MAX_CONCURRENT_JOBS,
    retention: {
      maxJobAgeHours: MAX_JOB_AGE_HOURS,
      maxJobKeep: MAX_JOB_KEEP,
    },
    storage: getStorageStats(),
  };
}

function runPython(args, timeoutMs = 120000, onSpawn) {
  return new Promise((resolve, reject) => {
    const pythonExec = process.env.PYTHON_EXECUTABLE || 'python';
    const child = spawn(pythonExec, [pyEntry, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        SATELLITE_REQUEST_TIMEOUT: process.env.SATELLITE_REQUEST_TIMEOUT || '3',
        SATELLITE_REQUEST_ATTEMPTS: process.env.SATELLITE_REQUEST_ATTEMPTS || '1',
      },
    });

    if (typeof onSpawn === 'function') {
      onSpawn(child);
    }

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Python process timeout'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr || `Python exited with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Invalid JSON from python: ${stdout}`));
      }
    });
  });
}

app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    ok: true,
    service: 'sisrua-topography-api',
    branchGuard: 'v2-topografia-only',
    time: new Date().toISOString(),
  });
});

app.get('/api/topography/status', async (req, res) => {
  try {
    const status = await runPython(['--status']);
    res.json({
      ok: true,
      config: runtimeConfig,
      status,
      metrics: getMetricsSnapshot(),
      storage: getStorageStats(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'topography_status_failed',
      message: String(err.message || err),
    });
  }
});

app.post('/api/topography/config', (req, res) => {
  const body = req.body || {};
  if (typeof body.providerMode === 'string') runtimeConfig.providerMode = body.providerMode;
  if (typeof body.qualityMode === 'string') runtimeConfig.qualityMode = body.qualityMode;
  if (typeof body.autoDiagnostics === 'boolean') runtimeConfig.autoDiagnostics = body.autoDiagnostics;

  persistState();
  res.json({ ok: true, config: runtimeConfig });
});

app.get('/api/topography/metrics', (req, res) => {
  res.json({ ok: true, metrics: getMetricsSnapshot() });
});

app.post('/api/topography/cleanup', (req, res) => {
  const report = cleanupArtifacts();
  res.json({ ok: true, report, storage: getStorageStats() });
});

function normalizeJobPayload(body) {
  const payload = body || {};
  const qualityMode = String(payload.qualityMode || runtimeConfig.qualityMode || 'high');
  return {
    lat: Number(payload.lat),
    lng: Number(payload.lng),
    radius: Number(payload.radius ?? 100),
    qualityMode,
    strict: !!payload.strict,
  };
}

function isValidCoordinates(payload) {
  return Number.isFinite(payload.lat) && Number.isFinite(payload.lng);
}

function processJobQueue() {
  if (activeJobCount >= Math.max(1, MAX_CONCURRENT_JOBS)) {
    return;
  }

  const availableSlots = Math.max(1, MAX_CONCURRENT_JOBS) - activeJobCount;
  const queuedJobs = Array.from(jobStore.values())
    .filter((job) => job.status === 'queued' && !job.cancelRequested)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(0, availableSlots);

  queuedJobs.forEach((job) => {
    executeJob(job.id).catch(() => {
    });
  });
}

async function executeJob(jobId) {
  const job = jobStore.get(jobId);
  if (!job || job.status !== 'queued' || job.cancelRequested) {
    return;
  }

  job.status = 'running';
  job.startedAt = nowIso();
  jobStore.set(jobId, job);
  activeJobCount += 1;
  persistState();

  const args = [
    '--lat',
    String(job.payload.lat),
    '--lng',
    String(job.payload.lng),
    '--radius',
    String(job.payload.radius),
    '--quality-mode',
    String(job.payload.qualityMode),
    '--output',
    job.outputPath,
  ];

  if (job.payload.strict) {
    args.push('--strict');
  }

  const startTime = Date.now();
  try {
    const result = await runPython(args, 120000, (child) => {
      runningProcesses.set(jobId, child);
    });
    const elapsedMs = Date.now() - startTime;

    if (job.cancelRequested) {
      job.status = 'cancelled';
      job.error = 'Cancelled by user';
      job.finishedAt = nowIso();
      job.elapsedMs = elapsedMs;
      jobStore.set(jobId, job);
      persistState();
      return;
    }

    job.status = 'completed';
    job.result = result;
    job.elapsedMs = elapsedMs;
    job.finishedAt = nowIso();
    job.downloadUrl = `/api/topography/download/${job.id}`;
    jobStore.set(jobId, job);

    metrics.jobsCompleted += 1;
    accumulateMetrics(result, elapsedMs);
    persistState();
  } catch (err) {
    if (job.cancelRequested) {
      job.status = 'cancelled';
      job.error = 'Cancelled by user';
    } else {
      job.status = 'failed';
      job.error = String(err.message || err);
      metrics.jobsFailed += 1;
    }
    job.finishedAt = nowIso();
    jobStore.set(jobId, job);
    persistState();
  } finally {
    runningProcesses.delete(jobId);
    activeJobCount = Math.max(0, activeJobCount - 1);
    processJobQueue();
  }
}

app.post('/api/topography/jobs', (req, res) => {
  const payload = normalizeJobPayload(req.body);
  if (!isValidCoordinates(payload)) {
    res.status(400).json({ ok: false, error: 'invalid_coordinates', message: 'lat and lng must be numbers' });
    return;
  }

  const jobId = makeJobId();
  const outputName = `topography_${jobId}.dxf`;
  const outputPath = path.join(repoRoot, outputName);

  const job = {
    id: jobId,
    status: 'queued',
    cancelRequested: false,
    payload,
    outputPath,
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    elapsedMs: null,
    result: null,
    error: null,
    downloadUrl: null,
  };

  jobStore.set(jobId, job);
  metrics.jobsCreated += 1;
  persistState();
  processJobQueue();

  res.status(202).json({
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
    },
  });
});

app.get('/api/topography/jobs', (req, res) => {
  const jobs = Array.from(jobStore.values())
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 50)
    .map((job) => ({
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      elapsedMs: job.elapsedMs,
      payload: job.payload,
      cancelRequested: !!job.cancelRequested,
      error: job.error,
      downloadUrl: job.downloadUrl,
    }));
  res.json({ ok: true, jobs });
});

app.post('/api/topography/jobs/:id/cancel', (req, res) => {
  const job = jobStore.get(req.params.id);
  if (!job) {
    res.status(404).json({ ok: false, error: 'job_not_found' });
    return;
  }

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    res.json({ ok: true, job: { id: job.id, status: job.status, cancelRequested: !!job.cancelRequested } });
    return;
  }

  job.cancelRequested = true;
  if (job.status === 'queued') {
    job.status = 'cancelled';
    job.error = 'Cancelled by user';
    job.finishedAt = nowIso();
    jobStore.set(job.id, job);
    persistState();
    processJobQueue();
    res.json({ ok: true, job: { id: job.id, status: job.status, cancelRequested: true } });
    return;
  }

  const child = runningProcesses.get(job.id);
  if (child) {
    try {
      child.kill('SIGTERM');
      setTimeout(() => {
        try {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        } catch (_) {
        }
      }, 1500);
    } catch (_) {
    }
  }

  jobStore.set(job.id, job);
  persistState();
  res.json({ ok: true, job: { id: job.id, status: job.status, cancelRequested: true } });
});

app.get('/api/topography/jobs/:id', (req, res) => {
  const job = jobStore.get(req.params.id);
  if (!job) {
    res.status(404).json({ ok: false, error: 'job_not_found' });
    return;
  }

  res.json({
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      elapsedMs: job.elapsedMs,
      payload: job.payload,
      result: job.result,
      error: job.error,
      downloadUrl: job.downloadUrl,
    },
  });
});

app.get('/api/topography/download/:id', (req, res) => {
  const job = jobStore.get(req.params.id);
  if (!job || job.status !== 'completed') {
    res.status(404).json({ ok: false, error: 'job_not_ready' });
    return;
  }

  if (!fs.existsSync(job.outputPath)) {
    res.status(404).json({ ok: false, error: 'file_not_found' });
    return;
  }

  res.download(job.outputPath, path.basename(job.outputPath));
});

app.post('/api/topography/dxf', async (req, res) => {
  const {
    lat,
    lng,
    radius = 100,
    qualityMode = runtimeConfig.qualityMode,
    strict = false,
  } = req.body || {};

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ ok: false, error: 'invalid_coordinates', message: 'lat and lng must be numbers' });
    return;
  }

  const outputName = `topography_${Date.now()}.dxf`;
  const outputPath = path.join(repoRoot, outputName);

  const args = [
    '--lat',
    String(lat),
    '--lng',
    String(lng),
    '--radius',
    String(radius),
    '--quality-mode',
    String(qualityMode),
    '--output',
    outputPath,
  ];

  if (strict) {
    args.push('--strict');
  }

  try {
    const result = await runPython(args);
    res.json({
      ok: true,
      result,
      config: runtimeConfig,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'dxf_generation_failed',
      message: String(err.message || err),
    });
  }
});

const port = Number(process.env.PORT || 3001);
loadState();
cleanupArtifacts();
setInterval(() => {
  cleanupArtifacts();
}, CLEANUP_INTERVAL_MS);

app.listen(port, () => {
  process.stdout.write(`Topography API running on http://localhost:${port}\n`);
});