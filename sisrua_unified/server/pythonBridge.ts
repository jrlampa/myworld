import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
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

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds between retries

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

/**
 * Sleep for a specified number of milliseconds
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate DXF with retry logic
 * Retries up to MAX_RETRIES times on timeout or failure
 */
export const generateDxf = async (options: DxfOptions): Promise<string> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            logger.info('Attempting DXF generation', { 
                attempt, 
                maxRetries: MAX_RETRIES,
                outputFile: options.outputFile 
            });
            
            const result = await generateDxfInternal(options);
            
            if (attempt > 1) {
                logger.info('DXF generation succeeded after retry', { 
                    attempt, 
                    outputFile: options.outputFile 
                });
            }
            
            return result;
        } catch (error: any) {
            lastError = error;
            
            logger.warn('DXF generation attempt failed', {
                attempt,
                maxRetries: MAX_RETRIES,
                error: error.message,
                outputFile: options.outputFile
            });
            
            // If this was the last attempt, don't wait
            if (attempt < MAX_RETRIES) {
                logger.info('Retrying DXF generation after delay', {
                    attempt,
                    nextAttempt: attempt + 1,
                    delayMs: RETRY_DELAY_MS
                });
                await sleep(RETRY_DELAY_MS);
            }
        }
    }
    
    // All retries failed
    const errorMessage = `DXF generation failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`;
    logger.error('DXF generation failed after all retries', {
        attempts: MAX_RETRIES,
        lastError: lastError?.message,
        outputFile: options.outputFile
    });
    
    throw new Error(errorMessage);
};

/**
 * Internal DXF generation function (single attempt)
 * This is the original generateDxf logic without retry
 */
const generateDxfInternal = (options: DxfOptions): Promise<string> => {
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
        // Note: This assumes the application is always started from the project root,
        // which is enforced by npm scripts (dev) and WORKDIR (prod)
        const scriptPath = path.join(process.cwd(), 'py_engine/main.py');
        
        // Validate that the Python script exists
        if (!existsSync(scriptPath)) {
            const error = new Error(`Python script not found at: ${scriptPath} (cwd: ${process.cwd()})`);
            logger.error('Python script path validation failed', {
                scriptPath,
                cwd: process.cwd(),
                error: error.message
            });
            reject(error);
            return;
        }

        // Validate that the output directory exists and is writable
        const outputDir = path.dirname(options.outputFile);
        if (!existsSync(outputDir)) {
            const error = new Error(`Output directory does not exist: ${outputDir}`);
            logger.error('Output directory validation failed', {
                outputDir,
                outputFile: options.outputFile,
                error: error.message
            });
            reject(error);
            return;
        }
        
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
        
        // Timeout configuration (5 minutes for DXF generation)
        const TIMEOUT_MS = 5 * 60 * 1000;
        let timeoutId: NodeJS.Timeout | null = null;
        let isTimedOut = false;

        let stdoutData = '';
        let stderrData = '';

        // Set up timeout
        timeoutId = setTimeout(() => {
            isTimedOut = true;
            logger.error('Python process timeout', {
                timeoutMs: TIMEOUT_MS,
                outputFile: options.outputFile
            });
            pythonProcess.kill('SIGTERM');
            
            // Force kill if still running after 5 seconds
            setTimeout(() => {
                if (!pythonProcess.killed) {
                    logger.warn('Force killing Python process after SIGTERM timeout');
                    pythonProcess.kill('SIGKILL');
                }
            }, 5000);
        }, TIMEOUT_MS);

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
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            if (isTimedOut) {
                reject(new Error(`Python process timed out after ${TIMEOUT_MS / 1000} seconds`));
                return;
            }
            
            logger.info('Python process exited', { exitCode: code });
            if (code === 0) {
                resolve(stdoutData);
            } else {
                reject(new Error(`Python script failed with code ${code}\nStderr: ${stderrData}`));
            }
        });

        pythonProcess.on('error', (err) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            reject(new Error(`Failed to spawn python process: ${err.message}`));
        });
    });
};
