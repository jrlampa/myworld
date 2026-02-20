
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

let profileChart = null;

export function renderProfileChart(points) {
    const canvas = document.getElementById('profile-canvas');
    if (!canvas) return;

    if (points.length < 2) return;

    if (!profileChart) {
        const ctx = canvas.getContext('2d');
        profileChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: points.map((_, i) => i),
                datasets: [{
                    label: 'Elevation Profile',
                    data: points,
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    fill: true,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return null;
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.05)');
                        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.3)');
                        return gradient;
                    },
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#6366f1',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (ctx) => `Elevação: ${ctx.parsed.y.toFixed(2)}m`
                        }
                    }
                },
                scales: {
                    x: { display: false },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { size: 10 } }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                onHover: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const index = activeElements[0].index;
                        // Notify viewer to show crosshair
                        import('./viewer.js').then(m => m.showProfileCrosshair(index));
                    } else {
                        import('./viewer.js').then(m => m.hideProfileCrosshair());
                    }
                }
            }
        });
    } else {
        profileChart.data.labels = points.map((_, i) => i);
        profileChart.data.datasets[0].data = points;
        profileChart.update('none'); // Update without animation for smoothness
    }
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

export function updateLegend(mode) {
    const legend = document.getElementById('dynamic-legend');
    if (!legend) return;

    const config = {
        'natural': null,
        'elevation': { title: 'Elevação (m)', ramp: 'linear-gradient(to right, #1a9850, #ffffbf, #d73027)', labels: ['Baixa', 'Média', 'Alta'] },
        'slope': { title: 'Declividade (°)', ramp: 'linear-gradient(to right, #00ff00, #ffff00, #ff0000)', labels: ['0°', '20°', '45°+'] },
        'stability': { title: 'Instabilidade (FoS)', ramp: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00)', labels: ['Crítico', 'Médio', 'Estável'] },
        'aspect': {
            title: 'Aspecto (Cardial)', items: [
                { color: '#0000ff', label: 'Norte' }, { color: '#ffff00', label: 'Leste' },
                { color: '#ff0000', label: 'Sul' }, { color: '#00ff00', label: 'Oeste' }
            ]
        },
        'plan_curvature': { title: 'Curvatura (Planta)', ramp: 'linear-gradient(to right, #0000ff, #cccccc, #00ff00)', labels: ['Divergente', 'Plano', 'Convergente'] },
        'profile_curvature': { title: 'Curvatura (Perfil)', ramp: 'linear-gradient(to right, #0000ff, #cccccc, #00ff00)', labels: ['Convexa', 'Plano', 'Côncava'] },
        'solar': { title: 'Potencial Solar', ramp: 'linear-gradient(to right, #5555ff, #ffff55)', labels: ['Baixo', 'Alto'] }
    };

    const c = config[mode];
    if (!c) {
        legend.classList.remove('active');
        return;
    }

    legend.innerHTML = `<div class="legend-title">${c.title}</div>`;

    if (c.items) {
        c.items.forEach(item => {
            legend.innerHTML += `
                <div class="legend-item">
                    <div class="legend-color" style="background: ${item.color}"></div>
                    <span>${item.label}</span>
                </div>
            `;
        });
    } else if (c.ramp) {
        legend.innerHTML += `
            <div class="legend-ramp" style="background: ${c.ramp}"></div>
            <div class="legend-labels">
                ${c.labels.map(l => `<span>${l}</span>`).join('')}
            </div>
        `;
    }

    legend.classList.add('active');
}
