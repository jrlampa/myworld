import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DxfOptions {
    lat?: number;
    lon?: number;
    radius?: number;
    outputFile?: string;
    layers?: Record<string, boolean>;
    mode?: string;
    polygon?: string;
    projection?: string;
    targetZ?: number;
    pythonMode?: 'export' | 'analyze_pad';
}

export const generateDxf = (options: DxfOptions): Promise<string> => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../py_engine/main.py');
        const pythonCommand = process.env.PYTHON_COMMAND || 'python3';
        const args = [scriptPath];

        if (options.pythonMode === 'analyze_pad') {
            args.push(
                '--mode', 'analyze_pad',
                '--polygon', String(options.polygon || '[]'),
                '--target_z', String(options.targetZ || 0)
            );
        } else {
            args.push(
                '--lat', String(options.lat),
                '--lon', String(options.lon),
                '--radius', String(options.radius),
                '--output', String(options.outputFile),
                '--selection_mode', String(options.mode || 'circle'),
                '--polygon', String(options.polygon || '[]'),
                '--projection', String(options.projection || 'local'),
                '--no-preview'
            );
            if (options.layers) {
                args.push('--layers', JSON.stringify(options.layers));
            }
        }

        logger.info('Spawning Python process', { mode: options.pythonMode || 'export' });
        const pythonProcess = spawn(pythonCommand, args);

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => { stdoutData += data.toString(); });
        pythonProcess.stderr.on('data', (data) => { stderrData += data.toString(); });

        pythonProcess.on('close', (code) => {
            if (code === 0) resolve(stdoutData);
            else reject(new Error(`Python failed: ${stderrData}`));
        });
    });
};
