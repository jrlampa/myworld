const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3006;
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
            if (str.includes(`API running on`)) {
                console.log('Server ready.');
                resolve();
            }
            console.log('[SERVER]', str.trim());
        });
    });
}

async function test() {
    await startServer();

    try {
        console.log("Submitting job...");
        const res = await axios.post(`${BASE_URL}/api/topography/jobs`, {
            lat: -22.15018,
            lng: -42.92185,
            radius: 500,
            quality: 'high'
        });
        const jobId = res.data.job.id;
        console.log("Job ID:", jobId);

        let attempts = 0;
        while (attempts++ < 30) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await axios.get(`${BASE_URL}/api/topography/jobs/${jobId}`);
            const status = statusRes.data.job.status;

            if (status === 'completed') {
                const result = statusRes.data.job.result;
                const hydro = result.analysis.hydrology;

                console.log("\n--- HYDROLOGY VERIFICATION ---");
                if (hydro) {
                    console.log(`Streams Count: ${hydro.streams ? hydro.streams.length : 'MISSING'}`);
                    console.log(`Flow Dir Present: ${!!hydro.flow_direction}`);
                    console.log(`Flow Acc Present: ${!!hydro.flow_accum}`);

                    if (hydro.streams && hydro.streams.length > 0) {
                        console.log("Sample Stream segment length:", hydro.streams[0].length);
                    }
                    console.log("SUCCESS");
                } else {
                    console.log("FAILURE: Hydrology object missing");
                }
                break;
            } else if (status === 'failed') {
                console.log("FAILURE: Job status failed");
                console.log("Error:", statusRes.data.job.error);
                break;
            }
        }
    } catch (e) {
        console.log("FAILURE: Exception", e.message);
        if (e.response) {
            console.log("Response data length:", JSON.stringify(e.response.data).length);
        }
    } finally {
        serverProcess.kill();
        process.exit(0);
    }
}

test();
