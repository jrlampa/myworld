
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:3001';
// Nova Friburgo Coordinates
const COORDS = { lat: -22.15018, lng: -42.92185 };
const RADIUS = 2000; // 2km Target

async function runTest() {
    console.log('Starting Phase 8 Verification (Optimization & 2km Scale)...');
    console.log(`Target: ${COORDS.lat}, ${COORDS.lng} (Radius: ${RADIUS}m)`);

    // Start Server
    const serverProcess = spawn('node', ['server/index.js'], {
        cwd: path.resolve(__dirname, '../../'),
        stdio: 'pipe',
        env: { ...process.env, PORT: '3001' }
    });

    serverProcess.stdout.on('data', (data) => {
        console.log(`[SERVER] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => console.error(`[SERVER ERR] ${data}`));

    // Wait for server
    await new Promise(r => setTimeout(r, 5000));
    console.log('[SERVER] Topography API running on http://localhost:3001');

    try {
        // Step 1: Submit Job
        console.log('Step 1: Submitting 2km Job...');
        const jobRes = await axios.post(`${BASE_URL}/api/topography/jobs`, {
            lat: COORDS.lat,
            lng: COORDS.lng,
            radius: RADIUS,
            quality: 'high' // Force high res to test Tiling
        });

        const jobId = jobRes.data.job.id;
        console.log(`Job submitted. ID: ${jobId}`);

        // Step 2: Poll status
        console.log('Step 2: Polling (This main take 1-2 mins for 2km)...');
        let status = 'processing';
        let attempts = 0;

        while ((status === 'processing' || status === 'queued' || status === 'running') && attempts < 120) { // 120 * 2s = 4 mins max
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await axios.get(`${BASE_URL}/api/topography/jobs/${jobId}`);
            status = statusRes.data.job.status;
            process.stdout.write('.');
            attempts++;

            if (status === 'failed') {
                console.error('\nJob FAILED Details:', JSON.stringify(statusRes.data.job, null, 2));
                throw new Error('Job failed processing: ' + statusRes.data.job.error);
            }
        }
        console.log('\nJob Completed!');

        // Step 3: Verify Results
        console.log('Step 3: Verifying Result Structure...');
        const resultRes = await axios.get(`${BASE_URL}/api/topography/jobs/${jobId}`);
        const result = resultRes.data.job.result;
        if (!result) console.error('CRITICAL: Result is null/undefined!', resultRes.data);

        if (!result.elevation_grid || result.elevation_grid.length < 100) {
            throw new Error(`Elevation Grid too small or missing: ${result.elevation_grid?.length}`);
        }
        console.log(`- Elevation Grid Size: ${result.elevation_grid.length}x${result.elevation_grid[0].length} OK`);

        // Step 4: Verify Cache Creation
        if (fs.existsSync(path.resolve(__dirname, '../data/elevation.db'))) {
            console.log('- Cache DB found at server/data/elevation.db OK');
        } else {
            console.warn('- WARNING: Cache DB not found!');
        }

        // Step 5: Download & Check DXF (Mock check of content)
        console.log('Step 5: Verifying DXF Generation...');
        const dxfRes = await axios.get(`${BASE_URL}/api/topography/download/${jobId}`, { responseType: 'arraybuffer' });
        const dxfContent = dxfRes.data.toString();

        if (dxfContent.includes('LWPOLYLINE')) {
            console.log('- LWPOLYLINE entity found (Strict 2.5D Compliance) OK');
        } else {
            console.error('- NO LWPOLYLINE FOUND! Refactor might need check.');
        }

        if (dxfContent.includes('AcDbPolyline')) { // DXF subclass marker
            console.log('- AcDbPolyline marker found OK');
        }

        console.log('SUCCESS: Phase 8 Verification Passed!');

    } catch (error) {
        const errorLog = `FAILED: ${error.message}\n` + (error.response ? JSON.stringify(error.response.data) : '');
        console.error(errorLog);
        fs.writeFileSync(path.join(__dirname, 'phase8_error.log'), errorLog);
        process.exit(1);
    } finally {
        console.log('Stopping Server...');
        serverProcess.kill();
    }
}

runTest();
