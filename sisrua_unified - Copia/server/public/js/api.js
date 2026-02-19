
import { state } from './state.js';
import { showToast } from './utils.js';
import { loadResult } from './viewer.js';

export async function startGeneration() {
    if (state.jobId) return;

    const btn = document.getElementById('btn-generate');
    const loader = document.getElementById('btn-loader');
    const txt = document.getElementById('btn-text');

    if (btn) btn.classList.add('btn-secondary');
    if (loader) loader.style.display = 'block';
    if (txt) txt.innerText = 'Queued...';

    showToast('Starting Topography Engine...', 'loading');

    const payload = {
        lat: state.lat,
        lng: state.lng,
        radius: state.radius,
        qualityMode: document.getElementById('quality').value,
        dxfPreset: document.getElementById('dxf-preset').value, // Add preset to payload if backend supports it
        bounds: state.customBounds
    };

    // Note: Backend might need update to accept dxfPreset in job payload if it's not already
    // The previous implementation added 'preset' to CLI args.
    // If backend only reads 'preset' from payload, we should send it.
    // The previous analysis payload didn't strictly use 'preset' for generation 
    // but for export later? 
    // Actually, 'preset' was passed to export logic. 
    // Is it needed for generation? Maybe for contour interval decision?
    // Current backend logic generates contours in 'TopographyService' with hardcoded intervals (1.0, 5.0).
    // If we want dynamic intervals, we should pass preset.
    // For now, let's just pass it.

    try {
        const res = await fetch('/api/topography/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.ok) {
            state.jobId = data.job.id;
            pollJob(state.jobId);
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        console.error(e);
        showToast('API Error: ' + e.message, 'error');
        resetUI();
    }
}

function pollJob(id) {
    state.pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/topography/jobs/${id}`);
            const data = await res.json();

            if (data.ok) {
                const job = data.job;
                const txt = document.getElementById('btn-text');
                if (txt) txt.innerText = job.status.toUpperCase();

                if (job.status === 'completed') {
                    clearInterval(state.pollInterval);
                    showToast('Analysis Complete!', 'success');
                    loadResult(job.result);
                    resetUI(true);
                } else if (job.status === 'failed') {
                    clearInterval(state.pollInterval);
                    showToast('Failed: ' + job.error, 'error');
                    resetUI();
                }
            }
        } catch (e) {
            clearInterval(state.pollInterval);
            resetUI();
        }
    }, 2000);
}

export function resetUI(success = false) {
    state.jobId = null;
    const btn = document.getElementById('btn-generate');
    const loader = document.getElementById('btn-loader');
    const txt = document.getElementById('btn-text');

    if (btn) btn.classList.remove('btn-secondary');
    if (loader) loader.style.display = 'none';
    if (txt) txt.innerText = 'Generate 3D Model';

    if (success) {
        const results = document.getElementById('results-section');
        if (results) {
            results.style.opacity = '1';
            results.style.pointerEvents = 'auto';
        }

        const viewer = document.getElementById('viewer-container');
        if (viewer) {
            viewer.style.display = 'block';
            viewer.classList.add('active');
        }

        window.dispatchEvent(new Event('resize'));
    }
}

export function downloadDXF() {
    if (state.lastResult && state.lastResult.filename) {
        window.location.href = `/api/topography/download/${state.jobId}`;
    }
}

export function downloadSTL() {
    if (state.lastResult && state.jobId) {
        window.location.href = `/api/topography/download/${state.jobId}?format=stl`;
    } else {
        showToast('No result available to download', 'error');
    }
}
