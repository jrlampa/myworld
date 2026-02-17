import { spawn } from 'child_process';
import fs from 'fs';
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
    projection?: string;
}

export const generateDxf = (options: DxfOptions): Promise<string> => {
    return new Promise((resolve, reject) => {
        const isProduction = process.env.NODE_ENV === 'production';

        // Path logic for standalone EXE vs source
        const exeName = 'sisrua_engine.exe';
        const prodExePath = path.join(__dirname, '../../engine', exeName);
        const devExePath = path.resolve(__dirname, '../../py_engine/dist', exeName);
        // In production (Docker): __dirname = /app/server/dist/server, py_engine is at /app/py_engine
        // In development: __dirname = /path/to/server, py_engine is at ../py_engine
        const scriptPath = isProduction 
            ? '/app/py_engine/main.py'
            : path.resolve(__dirname, '../../py_engine/main.py');

        let command: string;
        let args: string[];

        // Check if EXE exists in expected production or dev dist location
        if (isProduction || fs.existsSync(devExePath)) {
            const finalExePath = isProduction ? prodExePath : devExePath;
            if (fs.existsSync(finalExePath)) {
                command = finalExePath;
                args = [];
            } else {
                // In production (Ubuntu), use python3; in dev, use python
                command = isProduction ? 'python3' : 'python';
                args = [scriptPath];
            }
        } else {
            command = 'python';
            args = [scriptPath];
        }

        // Add DXF arguments
        args.push(
            '--lat', options.lat.toString(),
            '--lon', options.lon.toString(),
            '--radius', options.radius.toString(),
            '--output', options.outputFile,
            '--selection_mode', options.mode || 'circle',
            '--polygon', options.polygon || '[]',
            '--no-preview'
        );

        if (options.layers) {
            args.push('--layers', JSON.stringify(options.layers));
        }

        console.log(`[PythonBridge] Spawning: ${command} ${args.join(' ')}`);

        const pythonProcess = spawn(command, args);

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
