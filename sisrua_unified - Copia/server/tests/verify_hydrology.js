const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;

let serverProcess = null;

async function startServer() {
    return new Promise((resolve) => {
        const serverPath = path.join(__dirname, '../index.js');
        console.log(`Starting server on port ${PORT}...`);

        serverProcess = spawn('node', [serverPath], {
            cwd: path.join(__dirname, '../../'),
            stdio: 'pipe',
            env: { ...process.env, PORT: PORT.toString() }
        });

        serverProcess.stdout.on('data', (data) => {
            const str = data.toString();
            // console.log('[Server]:', str);
            if (str.includes(`API running on`)) {
                console.log('Server ready.');
                resolve();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.error('[Server Error]:', data.toString());
        });
    });
}

async function testHydrology() {
    await startServer();
    console.log("Submitting Hydrology Test Job...");

    // Nova Friburgo partial
    const payload = {
        lat: -22.15018,
        lng: -42.92185,
        radius: 500,
        quality: 'high'
    };

    try {
        const res = await axios.post(`${BASE_URL}/api/topography/jobs`, payload);
        const jobId = res.data.job.id;
        console.log(`Job submitted: ${jobId}`);

        // Poll
        let status = 'queued';
        while (status !== 'completed' && status !== 'failed') {
            await new Promise(r => setTimeout(r, 2000));
            try {
                const statusRes = await axios.get(`${BASE_URL}/api/topography/jobs/${jobId}`);
                status = statusRes.data.job.status;
                process.stdout.write('.');

                if (status === 'failed') {
                    console.error('\nJob Failed:', statusRes.data.job.error);
                    break;
                }
                if (status === 'completed') {
                    console.log('\nJob Completed!');
                    const result = statusRes.data.job.result;

                    if (result.analysis && result.analysis.hydrology) {
                        const hydro = result.analysis.hydrology;
                        console.log('Hydrology Data Found:');
                        console.log(`- Streams: ${hydro.streams ? hydro.streams.length : 0} segments`);
                        console.log(`- Flow Direction: ${!!hydro.flow_direction}`);
                        console.log(`- Flow Accumulation: ${!!hydro.flow_accum}`);

                        if (hydro.streams && hydro.streams.length > 0) {
                            console.log('Sample Stream Start:', JSON.stringify(hydro.streams[0][0]));
                        } else {
                            console.warn('WARNING: No streams found.');
                        }
                    } else {
                        console.error('ERROR: Hydrology object missing.');
                    }
                }
            } catch (err) {
                console.error('Polling error:', err.message);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    } catch (e) {
        console.error('Test failed:', e.message);
        if (e.response) {
            console.error('Response:', e.response.data);
        }
    } finally {
        if (serverProcess) {
            console.log('Stopping server...');
            serverProcess.kill();
        }
        process.exit(0);
    }
}

testHydrology();
