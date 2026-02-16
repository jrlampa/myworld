import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { Job, JobStatus, OsmEngineParams } from '../types';

export class JobManager {
  private jobs: Map<string, Job> = new Map();
  private maxConcurrentJobs = 2; // Limit parallel heavy processing
  private runningJobs = 0;
  private queue: { jobId: string; params: OsmEngineParams; pythonPath: string; scriptPath: string }[] = [];

  constructor() {
    // Start Garbage Collector every 30 minutes
    setInterval(() => this.runGarbageCollector(), 30 * 60 * 1000);
  }

  createJob(params: OsmEngineParams): string {
    const jobId = uuidv4();
    const now = Date.now();
    const job: Job = {
      id: jobId,
      status: 'pending',
      progress: 0,
      message: 'Pending in queue...',
      logs: [],
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(jobId, job);
    return jobId;
  }

  enqueueJob(jobId: string, params: OsmEngineParams, pythonPath: string, scriptPath: string) {
    this.queue.push({ jobId, params, pythonPath, scriptPath });
    this.processQueue();
  }

  private processQueue() {
    if (this.runningJobs >= this.maxConcurrentJobs || this.queue.length === 0) {
      return;
    }

    const { jobId, params, pythonPath, scriptPath } = this.queue.shift()!;
    this.startJobExecution(jobId, params, pythonPath, scriptPath);
  }

  private startJobExecution(jobId: string, params: OsmEngineParams, pythonPath: string, scriptPath: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    this.runningJobs++;
    job.status = 'running';
    job.updatedAt = Date.now();
    job.outputFile = params.output;

    const args = [
      scriptPath,
      '--lat', params.lat.toString(),
      '--lon', params.lon.toString(),
      '--radius', params.radius.toString(),
      '--output', params.output,
      '--layers', JSON.stringify(params.layers),
      '--crs', params.crs,
      '--format', params.format || 'dxf',
      '--selection_mode', params.selectionMode || 'circle',
      '--polygon', JSON.stringify(params.polygon || []),
      '--client_name', params.clientName || 'CLIENTE PADRÃO',
      '--project_id', params.projectId || 'PROJETO URBANISTICO',
      '--no-preview'
    ];

    const child = spawn(pythonPath, args);
    job.process = child;

    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach((line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const json = JSON.parse(trimmed);
          if (json.status) job.message = json.message;
          if (json.progress !== undefined) job.progress = json.progress;
          job.logs.push(trimmed);
        } catch (e) {
          job.message = trimmed;
          job.logs.push(trimmed);
        }
        job.updatedAt = Date.now();
      });
    });

    child.stderr.on('data', (data) => {
      const err = data.toString();
      job.logs.push(`ERR: ${err}`);
      job.updatedAt = Date.now();
    });

    child.on('close', (code) => {
      this.runningJobs--;
      if (code === 0) {
        job.status = 'completed';
        job.progress = 100;
        job.message = 'Job completed successfully.';
      } else {
        job.status = 'error';
        job.message = `Process exited with code ${code}`;
      }
      job.updatedAt = Date.now();
      this.processQueue();
    });
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  private runGarbageCollector() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [id, job] of this.jobs.entries()) {
      // Remove completed/error jobs older than 1 hour
      if ((job.status === 'completed' || job.status === 'error') && (now - job.updatedAt > oneHour)) {
        this.jobs.delete(id);
      }

      // Safety: kill and remove "stuck" running jobs older than 2 hours
      if (job.status === 'running' && (now - job.updatedAt > oneHour * 2)) {
        if (job.process) job.process.kill();
        this.jobs.delete(id);
      }
    }
  }

  deleteJob(jobId: string) {
    const job = this.jobs.get(jobId);
    if (job?.process) {
      job.process.kill();
    }
    this.jobs.delete(jobId);
  }
}
