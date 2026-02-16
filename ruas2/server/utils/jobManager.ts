
import { randomUUID } from 'crypto';

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  result: any | null;
  error: string | null;
  createdAt: number;
}

class JobManager {
  private jobs: Map<string, Job> = new Map();
  private readonly TIMEOUT_MS = 1000 * 60 * 15; // 15 Minutes retention

  constructor() {
    // Auto-cleanup every minute
    setInterval(() => this.cleanup(), 60000);
  }

  createJob(): string {
    const id = randomUUID();
    this.jobs.set(id, {
      id,
      status: 'pending',
      progress: 0,
      message: 'Job criado, aguardando início...',
      result: null,
      error: null,
      createdAt: Date.now()
    });
    return id;
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  updateProgress(id: string, progress: number, message: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'processing';
      job.progress = progress;
      job.message = message;
    }
  }

  completeJob(id: string, result: any) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.message = 'Concluído com sucesso.';
      job.result = result;
    }
  }

  failJob(id: string, error: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.message = 'Falha no processamento.';
    }
  }

  private cleanup() {
    const now = Date.now();
    let deleted = 0;
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > this.TIMEOUT_MS) {
        this.jobs.delete(id);
        deleted++;
      }
    }
    if (deleted > 0) console.log(`[JobManager] Cleaned up ${deleted} stale jobs.`);
  }
}

export const jobManager = new JobManager();
