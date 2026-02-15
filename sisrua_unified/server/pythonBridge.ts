import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DxfOptions {
    lat: number;
    lon: number;
    radius: number;
    outputFile: string;
    layers?: Record<string, boolean>;
    mode?: string;
    polygon?: string;
}

export const generateDxf = (options: DxfOptions): Promise<string> => {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../py_engine/main.py');

        // Arguments for main.py
        // --lat --lon --radius --output --layers
        const args = [
            scriptPath,
            '--lat', options.lat.toString(),
            '--lon', options.lon.toString(),
            '--radius', options.radius.toString(),
            '--output', options.outputFile,
            '--selection_mode', options.mode || 'circle',
            '--polygon', options.polygon || '[]',
            '--no-preview' // For now, we don't need the preview JSON in the response
        ];

        if (options.layers) {
            args.push('--layers', JSON.stringify(options.layers));
        }

        console.log(`[PythonBridge] Spawning: python ${args.join(' ')}`);

        const pythonProcess = spawn('python', args);

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            const str = data.toString();
            console.log(`[Python stdout] ${str}`);
            stdoutData += str;
        });

        pythonProcess.stderr.on('data', (data) => {
            const str = data.toString();
            console.error(`[Python stderr] ${str}`);
            stderrData += str;
        });

        pythonProcess.on('close', (code) => {
            console.log(`[PythonBridge] Process exited with code ${code}`);
            if (code === 0) {
                resolve(stdoutData);
            } else {
                reject(new Error(`Python script failed with code ${code}\nStderr: ${stderrData}`));
            }
        });

        pythonProcess.on('error', (err) => {
            reject(new Error(`Failed to spawn python process: ${err.message}`));
        });
    });
};
