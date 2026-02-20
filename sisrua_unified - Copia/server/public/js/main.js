
import { initMap } from './map.js';
import { initThree, loadResult, toggleLayer, toggleRuler, updateSun } from './viewer.js';
import { startGeneration, downloadDXF, downloadSTL } from './api.js';
import { toggleSimulation, setupUIListeners } from './ui.js';
import { state } from './state.js';

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize
    if (window.feather) window.feather.replace();

    initMap();
    initThree();

    // Bind Global Functions for ease of use or bind directly
    // Ideally we remove onclick from HTML and bind here.

    const actions = {
        'btn-generate': startGeneration,
        'btn-sim': toggleSimulation,
        'btn-ruler': toggleRuler,
        'view-mesh': () => toggleLayer('mesh'),
        'view-hydro': () => toggleLayer('hydro'),
        'view-forest': () => toggleLayer('forest'),
        'view-contours': () => toggleLayer('contours'),
        'btn-flow-anim': () => toggleFlowAnimation(),
        'layout-toggle': toggleMapLayout,
        // Downloads
        // need to bind manually or via map
    };

    // Manual bindings for specific buttons that might not have IDs in 'actions' map 
    // or need specific arguments (like VizMode)

    document.querySelector('button[onclick="downloadDXF()"]')?.addEventListener('click', downloadDXF);
    document.querySelector('button[onclick="downloadSTL()"]')?.addEventListener('click', downloadSTL);

    // Bind Viz Mode buttons
    const analyticalModes = [
        'natural', 'elevation', 'slope', 'solar', 'aspect',
        'watershed', 'tpi', 'tri', 'landform', 'cutfill',
        'stability', 'plan_curvature', 'profile_curvature'
    ];

    analyticalModes.forEach(mode => {
        const btn = document.getElementById(`mode-${mode}`);
        if (btn) {
            btn.addEventListener('click', () => setVizMode(mode));
        }
    });

    // Bind Earthworks Slider (Phase 11)
    const targetZslider = document.getElementById('target-z-slider');
    if (targetZslider) {
        targetZslider.addEventListener('input', (e) => {
            const z = parseFloat(e.target.value);
            document.getElementById('target-z-val').textContent = z.toFixed(2) + 'm';
            state.targetElevation = z;
            // Debounce or immediate update? Immediate update for colors, 
            // but volume calculation needs a light recalculation.
            import('./viewer.js').then(m => m.updateMeshColors());
        });
    }

    // Bind Layer Toggles (those with ID view-*)
    // Already in actions? Yes.

    // Bind Hydrology Checkbox
    const checkHydro = document.getElementById('check-hydro');
    if (checkHydro) {
        checkHydro.addEventListener('change', (e) => {
            // toggleHydrology logic:
            if (state.layers.hydro) state.layers.hydro.visible = e.target.checked;
        });
    }

    // Bind Map Layout Toggle
    const layoutBtn = document.querySelector('button[onclick="toggleMapLayout()"]');
    if (layoutBtn) layoutBtn.addEventListener('click', toggleMapLayout);

    // Bind Simulation
    const simBtn = document.getElementById('btn-sim');
    if (simBtn) simBtn.addEventListener('click', toggleSimulation);

    // Bind Ruler
    const rulerBtn = document.getElementById('btn-ruler');
    if (rulerBtn) rulerBtn.addEventListener('click', toggleRuler);

    // Bind Generation
    const genBtn = document.getElementById('btn-generate');
    if (genBtn) genBtn.addEventListener('click', startGeneration);

    // Bind simple layer toggles (Satellite/Terrain) if they exist
    // They seem to be purely map/visual toggles or leaflet toggles?
    // "toggleLayer('terrain')" in HTML.
    // In viewer.js toggleLayer is for 3D layers.
    // In HTML, 'terrain' and 'satellite' buttons call 'toggleLayer'.
    // BUT they might refer to Leaflet layers? 
    // In original HTML:
    // <button class="layer-btn active" onclick="toggleLayer('terrain')">Terreno</button>
    // And `toggleLayer` implementation:
    // ... if (key === 'contours') ... if (state.layers[key]) ...
    // It seems 'terrain' and 'satellite' were NOT handled in original `toggleLayer`?
    // Let's check original `analyzer.html`.
    // Lines 1472+.
    // It only checks `contours` and `state.layers[key]`.
    // Does `state.layers` have 'terrain' or 'satellite'? 
    // No. `layers: { mesh, wire, hydro, forest, contours, ruler, drawLayer }`.
    // So the original buttons for Terrain/Satellite might have been non-functional or I missed something?
    // Ah, 'terrain' usually implies the 2D map layer? 
    // But `initMap` adds Esri Imagery (Satellite).
    // Maybe they were intended to switch Leaflet basemaps?
    // I will implement them as Leaflet basemap toggles if I can.

    // Fix: Add handlers for Terrain/Satellite if needed.
    // For now, I will bind them to a log or stub.
});

// Helper for VizMode
function setVizMode(mode) {
    state.vizMode = mode;
    const analyticalModes = [
        'natural', 'elevation', 'slope', 'solar', 'aspect',
        'watershed', 'tpi', 'tri', 'landform', 'cutfill',
        'stability', 'plan_curvature', 'profile_curvature'
    ];

    analyticalModes.forEach(m => {
        const b = document.getElementById(`mode-${m}`);
        if (b) b.classList.toggle('active', m === mode);
    });

    // Update Legend
    import('./ui.js').then(m => m.updateLegend(mode));

    // Toggle Earthworks Panel
    const earthPanel = document.getElementById('earthworks-panel');
    if (earthPanel) {
        earthPanel.style.display = (mode === 'cutfill') ? 'block' : 'none';

        // Initialize slider range based on current elevation if possible
        if (mode === 'cutfill' && state.lastResult?.analysis?.elevation_range) {
            const slider = document.getElementById('target-z-slider');
            const [min, max] = state.lastResult.analysis.elevation_range;
            slider.min = Math.floor(min - 5);
            slider.max = Math.ceil(max + 5);
            // Default to mean if null
            if (state.targetElevation === null) {
                state.targetElevation = (min + max) / 2;
                slider.value = state.targetElevation;
                document.getElementById('target-z-val').textContent = state.targetElevation.toFixed(2) + 'm';
            }
        }
    }

    import('./viewer.js').then(m => m.updateMeshColors());
}

function toggleFlowAnimation() {
    state.animateFlow = !state.animateFlow;
    const btn = document.getElementById('btn-flow-anim');
    if (btn) btn.classList.toggle('active', state.animateFlow);
}

function toggleMapLayout() {
    const mapDiv = document.getElementById('map-container');
    const viewerDiv = document.getElementById('viewer-container');
    if (mapDiv.style.display === 'none') {
        mapDiv.style.display = 'block';
        viewerDiv.style.flex = '1';
    } else {
        mapDiv.style.display = 'none';
        viewerDiv.style.flex = '1';
    }
    // Resize Three.js
    window.dispatchEvent(new Event('resize'));
}

