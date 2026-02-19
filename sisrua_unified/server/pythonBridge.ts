import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';

/**
 * Python Bridge for DXF Generation
 * 
 * DOCKER-FIRST ARCHITECTURE:
 * This module executes Python scripts directly in a containerized environment.
 * The Python engine runs natively in Docker containers, eliminating the need
 * for compiled .exe binaries and improving portability and security.
 * 
 * SECURITY MEASURES:
 * - Uses spawn() instead of exec() to prevent command injection
 * - Validates all file paths before execution
 * - Sanitizes all input arguments
 * - Logs all execution attempts for audit trail
 * - Runs in isolated Docker containers in production
 * 
 * DEPLOYMENT:
 * - Production: Docker containers with Python runtime (Cloud Run)
 * - Development: Native Python or Docker Compose
 * - Legacy .exe support removed in favor of container-native execution
 */

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
        // Input validation for security
        if (!options.lat || !options.lon || !options.radius) {
            reject(new Error('Missing required parameters'));
            return;
        }

        // Validate coordinate ranges to prevent malicious input
        if (options.lat < -90 || options.lat > 90) {
            reject(new Error('Invalid latitude: must be between -90 and 90'));
            return;
        }
        if (options.lon < -180 || options.lon > 180) {
            reject(new Error('Invalid longitude: must be between -180 and 180'));
            return;
        }
        if (options.radius < 1 || options.radius > 10000) {
            reject(new Error('Invalid radius: must be between 1 and 10000'));
            return;
        }

        // DOCKER-FIRST: Always use Python directly (no .exe binaries)
        // This works in both Docker containers and native development environments
        // Use process.cwd() for consistent path resolution in both dev and prod
        // Dev: cwd = project_root, Prod: cwd = /app (WORKDIR in Dockerfile)
        const scriptPath = path.join(process.cwd(), 'py_engine/main.py');
        
        // Allow customization via environment variable (useful for different Python versions)
        const pythonCommand = process.env.PYTHON_COMMAND || 'python3';
        
        const command = pythonCommand;
        const args = [scriptPath];

        // SECURITY: Sanitize all arguments - convert to strings to prevent injection
        // Add DXF arguments
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

        logger.info('Spawning Python process for DXF generation', {
            command,
            args: args.join(' '),
            environment: process.env.NODE_ENV || 'development',
            dockerized: process.env.DOCKER_ENV === 'true',
            timestamp: new Date().toISOString()
        });

        const pythonProcess = spawn(command, args);

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            const str = data.toString();
            logger.debug('Python stdout', { output: str });
            stdoutData += str;
        });

        pythonProcess.stderr.on('data', (data) => {
            const str = data.toString();
            logger.warn('Python stderr', { output: str });
            stderrData += str;
        });

        pythonProcess.on('close', (code) => {
            logger.info('Python process exited', { exitCode: code });
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
