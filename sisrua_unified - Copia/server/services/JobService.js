const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MetricService = require('./MetricService');
const ExportService = require('./ExportService');

class JobService {
    constructor() {
        this.repoRoot = path.resolve(__dirname, '..', '..');
        this.stateDir = path.join(this.repoRoot, 'server', 'data');
        this.stateFile = path.join(this.stateDir, 'topography-state.json');
        this.jobStore = new Map();
        this.activeJobCount = 0;

        this.config = {
            MAX_JOB_AGE_HOURS: Number(process.env.TOPOGRAPHY_JOB_RETENTION_HOURS || 24),
            MAX_JOB_KEEP: Number(process.env.TOPOGRAPHY_MAX_JOBS || 200),
            MAX_CONCURRENT_JOBS: Number(process.env.TOPOGRAPHY_MAX_CONCURRENT_JOBS || 2),
            runtime: {
                providerMode: 'premium-first',
                qualityMode: 'high',
                autoDiagnostics: true,
            }
        };

        this.ensureStateDir();
        this.loadState();
    }

    ensureStateDir() {
        if (!fs.existsSync(this.stateDir)) fs.mkdirSync(this.stateDir, { recursive: true });
    }

    makeJobId() {
        return `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    }

    serializeJob(job) {
        return { ...job, result: job.result, error: job.error };
    }

    persistState() {
        try {
            const jobs = Array.from(this.jobStore.values()).map(this.serializeJob);
            const payload = {
                runtimeConfig: this.config.runtime,
                metrics: MetricService,
                jobs,
                persistedAt: new Date().toISOString(),
            };
            fs.writeFileSync(this.stateFile, JSON.stringify(payload, null, 2), 'utf8');
        } catch (_) { }
    }

    loadState() {
        try {
            if (!fs.existsSync(this.stateFile)) return;
            const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            if (data.runtimeConfig) Object.assign(this.config.runtime, data.runtimeConfig);
            if (data.metrics) Object.assign(MetricService, data.metrics);
            if (Array.isArray(data.jobs)) {
                data.jobs.forEach(job => {
                    if (job.status === 'running' || job.status === 'queued') {
                        job.status = 'failed';
                        job.error = 'Recovered after restart';
                        job.finishedAt = new Date().toISOString();
                    }
                    this.jobStore.set(job.id, job);
                });
            }
        } catch (_) { }
    }

    async createJob(payload) {
        const jobId = this.makeJobId();
        const outputName = `topography_${jobId}.dxf`;
        const outputPath = path.join(this.repoRoot, outputName);

        const job = {
            id: jobId,
            status: 'queued',
            cancelRequested: false,
            payload,
            outputPath,
            createdAt: new Date().toISOString(),
            startedAt: null,
            finishedAt: null,
            elapsedMs: null,
            result: null,
            error: null,
            downloadUrl: null,
        };

        this.jobStore.set(jobId, job);
        MetricService.jobsCreated += 1;
        this.persistState();
        this.processQueue();
        return job;
    }

    processQueue() {
        if (this.activeJobCount >= this.config.MAX_CONCURRENT_JOBS) return;
        const queued = Array.from(this.jobStore.values())
            .filter(j => j.status === 'queued' && !j.cancelRequested)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .slice(0, this.config.MAX_CONCURRENT_JOBS - this.activeJobCount);

        queued.forEach(job => this.executeJob(job.id));
    }

    async executeJob(jobId) {
        const job = this.jobStore.get(jobId);
        if (!job) return;

        job.status = 'running';
        job.startedAt = new Date().toISOString();
        this.activeJobCount += 1;
        this.persistState();

        const args = [
            '--lat', String(job.payload.lat),
            '--lng', String(job.payload.lng),
            '--radius', String(job.payload.radius),
            '--quality', String(job.payload.qualityMode),
            '--out', job.outputPath,
        ];
        if (job.payload.bounds) args.push('--bounds', JSON.stringify(job.payload.bounds));
        if (job.payload.strict) args.push('--strict');
        if (job.payload.target_z !== undefined) args.push('--target_z', String(job.payload.target_z));

        const startTime = Date.now();
        try {
            const result = await ExportService.runPython(args, 300000, null, jobId);
            const elapsedMs = Date.now() - startTime;

            if (job.cancelRequested) {
                job.status = 'cancelled';
                job.error = 'Cancelled by user';
            } else {
                job.status = 'completed';
                job.result = result;
                job.downloadUrl = `/api/topography/download/${job.id}`;
                MetricService.jobsCompleted += 1;
                MetricService.accumulate(result, elapsedMs);
            }
            job.elapsedMs = elapsedMs;
            job.finishedAt = new Date().toISOString();
        } catch (err) {
            if (!job.cancelRequested) {
                job.status = 'failed';
                job.error = String(err.message || err);
                MetricService.jobsFailed += 1;
            } else {
                job.status = 'cancelled';
            }
            job.finishedAt = new Date().toISOString();
        } finally {
            this.activeJobCount = Math.max(0, this.activeJobCount - 1);
            this.persistState();
            this.processQueue();
        }
    }

    cleanup() {
        const now = Date.now();
        const maxAgeMs = this.config.MAX_JOB_AGE_HOURS * 60 * 60 * 1000;
        const jobs = Array.from(this.jobStore.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        jobs.forEach(job => {
            const expired = (now - Date.parse(job.createdAt)) > maxAgeMs;
            const overCount = this.jobStore.size > this.config.MAX_JOB_KEEP;
            if (expired || overCount) {
                if (job.outputPath && fs.existsSync(job.outputPath)) {
                    try { fs.unlinkSync(job.outputPath); } catch (_) { }
                }
                this.jobStore.delete(job.id);
            }
        });
        this.persistState();
    }
}

module.exports = new JobService();
