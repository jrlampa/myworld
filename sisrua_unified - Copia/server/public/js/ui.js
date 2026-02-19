
import { state } from './state.js';
import { updateSun } from './viewer.js';

export function toggleSimulation() {
    const panel = document.getElementById('sim-panel');
    const btn = document.getElementById('btn-sim');
    if (!panel) return;

    const active = panel.classList.toggle('active');
    if (btn) btn.classList.toggle('active active', active);
    updateSun();
}

export function renderProfileChart(points) {
    const canvas = document.getElementById('profile-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width = 600;
    const h = canvas.height = 100;

    ctx.clearRect(0, 0, w, h);
    if (points.length < 2) return;

    const minZ = Math.min(...points);
    const maxZ = Math.max(...points);
    const range = maxZ - minZ || 1;

    ctx.beginPath();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;

    points.forEach((p, i) => {
        const tx = (i / (points.length - 1)) * w;
        const ty = h - ((p - minZ) / range) * h * 0.8 - h * 0.1;
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
    });
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(`${maxZ.toFixed(1)}m`, 5, 12);
    ctx.fillText(`${minZ.toFixed(1)}m`, 5, h - 5);
}

export function setupUIListeners(actions) {
    // Actions object maps IDs to functions
    // e.g. { 'btn-generate': startGeneration, ... }

    for (const [id, func] of Object.entries(actions)) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', func);
        }
    }

    // Sliders / Inputs
    const sunSlider = document.getElementById('sun-slider');
    if (sunSlider) sunSlider.addEventListener('input', updateSun);

    const checkHydro = document.getElementById('check-hydro');
    if (checkHydro) {
        checkHydro.addEventListener('change', (e) => {
            // Dynamic import or passed function
            if (actions.toggleHydrology) actions.toggleHydrology(e.target.checked);
        });
    }
}
