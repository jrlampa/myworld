const JobService = require('../services/JobService');
const MetricService = require('../services/MetricService');
const ExportService = require('../services/ExportService');
const fs = require('fs');
const path = require('path');

class TopographyController {
    getHealth(req, res) {
        res.json({ ok: true, service: 'sisrua-topography-api', time: new Date().toISOString() });
    }

    getStatus(req, res) {
        res.json({
            ok: true,
            config: JobService.config.runtime,
            metrics: MetricService.getSnapshot(JobService.jobStore.size, JobService.activeJobCount, JobService.config),
        });
    }

    updateConfig(req, res) {
        const { providerMode, qualityMode, autoDiagnostics } = req.body || {};
        if (providerMode) JobService.config.runtime.providerMode = providerMode;
        if (qualityMode) JobService.config.runtime.qualityMode = qualityMode;
        if (autoDiagnostics !== undefined) JobService.config.runtime.autoDiagnostics = autoDiagnostics;
        JobService.persistState();
        res.json({ ok: true, config: JobService.config.runtime });
    }

    getMetrics(req, res) {
        res.json({ ok: true, metrics: MetricService.getSnapshot(JobService.jobStore.size, JobService.activeJobCount, JobService.config) });
    }

    cleanup(req, res) {
        JobService.cleanup();
        res.json({ ok: true, status: 'cleanup_triggered' });
    }

    async createJob(req, res) {
        const { lat, lng, radius, qualityMode, strict, target_z, bounds } = req.body || {};
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return res.status(400).json({ ok: false, error: 'invalid_coordinates' });
        }
        const job = await JobService.createJob({ lat, lng, radius, qualityMode, strict, target_z, bounds });
        res.status(202).json({ ok: true, job: { id: job.id, status: job.status, createdAt: job.createdAt } });
    }

    getJobs(req, res) {
        const jobs = Array.from(JobService.jobStore.values())
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 50);
        res.json({ ok: true, jobs });
    }

    getJobDetail(req, res) {
        const job = JobService.jobStore.get(req.params.id);
        if (!job) return res.status(404).json({ ok: false, error: 'job_not_found' });
        res.json({ ok: true, job });
    }

    cancelJob(req, res) {
        const job = JobService.jobStore.get(req.params.id);
        if (!job) return res.status(404).json({ ok: false, error: 'job_not_found' });
        job.cancelRequested = true;
        if (job.status === 'running') ExportService.killProcess(job.id);
        JobService.persistState();
        res.json({ ok: true, status: 'cancel_requested', jobId: job.id });
    }

    downloadArtifact(req, res) {
        const job = JobService.jobStore.get(req.params.id);
        if (!job || job.status !== 'completed') return res.status(404).json({ ok: false, error: 'artifact_not_ready' });
        const format = req.query.format || 'dxf';
        let targetPath = job.outputPath;
        if (format === 'stl') targetPath = job.outputPath.replace(/\.dxf$/, '.stl');
        if (!fs.existsSync(targetPath)) return res.status(404).json({ ok: false, error: 'file_not_found' });
        res.download(targetPath, path.basename(targetPath));
    }
}

module.exports = new TopographyController();
