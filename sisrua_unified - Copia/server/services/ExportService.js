const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ExportService {
    constructor() {
        this.repoRoot = path.resolve(__dirname, '..', '..');
        this.pyEntry = path.join(this.repoRoot, 'py_engine', 'main.py');
        this.runningProcesses = new Map();
    }

    runPython(args, timeoutMs = 300000, onSpawn, jobId) {
        return new Promise((resolve, reject) => {
            const pythonExec = process.env.PYTHON_EXECUTABLE || 'python';
            const child = spawn(pythonExec, [this.pyEntry, ...args], {
                cwd: this.repoRoot,
                env: {
                    ...process.env,
                    SATELLITE_REQUEST_TIMEOUT: process.env.SATELLITE_REQUEST_TIMEOUT || '3',
                    SATELLITE_REQUEST_ATTEMPTS: process.env.SATELLITE_REQUEST_ATTEMPTS || '1',
                },
            });

            if (jobId) this.runningProcesses.set(jobId, child);
            if (typeof onSpawn === 'function') onSpawn(child);

            let stdout = '';
            let stderr = '';

            const timer = setTimeout(() => {
                child.kill('SIGKILL');
                reject(new Error('Python process timeout'));
            }, timeoutMs);

            child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
            child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

            child.on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                if (jobId) this.runningProcesses.delete(jobId);

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

    killProcess(jobId) {
        const child = this.runningProcesses.get(jobId);
        if (child) {
            child.kill('SIGTERM');
            setTimeout(() => {
                if (!child.killed) child.kill('SIGKILL');
            }, 1500);
            return true;
        }
        return false;
    }
}

module.exports = new ExportService();
