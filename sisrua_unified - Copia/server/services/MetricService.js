const fs = require('fs');
const path = require('path');

class MetricService {
    constructor() {
        this.startedAt = new Date().toISOString();
        this.jobsCreated = 0;
        this.jobsCompleted = 0;
        this.jobsFailed = 0;
        this.requestCount = 0;
        this.totalDurationMs = 0;
        this.providerUsage = {
            mapbox: 0,
            opentopodata: 0,
            'open-elevation': 0,
            'fallback-zero': 0,
        };
        this.qualityUsage = {
            balanced: 0,
            high: 0,
            ultra: 0,
        };
    }

    accumulate(result, elapsedMs) {
        this.requestCount += 1;
        this.totalDurationMs += elapsedMs;

        const qualityMode = result?.metadata?.quality_mode || 'high';
        this.qualityUsage[qualityMode] = (this.qualityUsage[qualityMode] || 0) + 1;

        const providers = result?.metadata?.providers_used || [];
        providers.forEach((provider) => {
            this.providerUsage[provider] = (this.providerUsage[provider] || 0) + 1;
        });
    }

    getSnapshot(jobStoreSize, activeJobCount, config) {
        const avgDurationMs = this.requestCount > 0 ? this.totalDurationMs / this.requestCount : 0;
        return {
            startedAt: this.startedAt,
            jobsCreated: this.jobsCreated,
            jobsCompleted: this.jobsCompleted,
            jobsFailed: this.jobsFailed,
            requestCount: this.requestCount,
            totalDurationMs: this.totalDurationMs,
            providerUsage: this.providerUsage,
            qualityUsage: this.qualityUsage,
            avgDurationMs: Number(avgDurationMs.toFixed(2)),
            activeJobs: activeJobCount,
            totalJobsStored: jobStoreSize,
            maxConcurrentJobs: config.MAX_CONCURRENT_JOBS,
            retention: {
                maxJobAgeHours: config.MAX_JOB_AGE_HOURS,
                maxJobKeep: config.MAX_JOB_KEEP,
            }
        };
    }
}

module.exports = new MetricService();
