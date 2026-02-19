
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state } from './state.js';
import { showToast } from './utils.js';

export function initThree() {
    const container = document.getElementById('viewer-container');

    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x0f172a);
    // Orthographic doesn't handle FogExp2 well with distance? 
    // Actually it works, but depth is linear.
    state.scene.fog = new THREE.FogExp2(0x0f172a, 0.0005);

    // Orthographic Camera Setup
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = state.radius * 2.5; // View coverage

    state.camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        1,
        10000
    );

    // Top-down view (Planar 2.5D)
    state.camera.position.set(0, 2000, 0);
    state.camera.lookAt(0, 0, 0);

    state.renderer = new THREE.WebGLRenderer({ antialias: true });
    state.renderer.setSize(container.clientWidth, container.clientHeight);
    state.renderer.shadowMap.enabled = true;
    container.appendChild(state.renderer.domElement);

    state.controls = new OrbitControls(state.camera, state.renderer.domElement);
    state.controls.enableDamping = true;
    state.controls.dampingFactor = 0.05;
    state.controls.screenSpacePanning = true; // Pan like a map

    // Lock Tilt to 2.5D (0 to 60 degrees)
    state.controls.minPolarAngle = 0;
    state.controls.maxPolarAngle = Math.PI / 3;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    state.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    const d = state.radius * 2;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    state.scene.add(sun);
    state.sunLight = sun;

    // Resize
    window.addEventListener('resize', onWindowResize);

    animate();
}

function onWindowResize() {
    const container = document.getElementById('viewer-container');
    if (container.style.display === 'none') return;

    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = state.radius * 2.5;

    state.camera.left = frustumSize * aspect / -2;
    state.camera.right = frustumSize * aspect / 2;
    state.camera.top = frustumSize / 2;
    state.camera.bottom = frustumSize / -2;

    state.camera.updateProjectionMatrix();
    state.renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    state.controls.update();
    if (typeof updateFlowParticles === 'function') updateFlowParticles();
    state.renderer.render(state.scene, state.camera);
}

export function loadResult(result) {
    state.lastResult = result;
    const analysis = result.analysis;
    const size = analysis.grid_size;

    // Cleanup
    ['mesh', 'hydro', 'forest', 'contours', 'ruler', 'watersheds', 'flowParticles'].forEach(k => {
        if (state.layers[k]) {
            state.scene.remove(state.layers[k]);
            state.layers[k] = null;
        }
    });

    if (!analysis.elevation_grid) {
        showToast('Error: No elevation data', 'error');
        return;
    }

    // Stats
    const elevs = analysis.elevation_grid.flat();
    const minZ = Math.min(...elevs);
    const maxZ = Math.max(...elevs);

    document.getElementById('stat-min').innerText = minZ.toFixed(1) + 'm';
    document.getElementById('stat-max').innerText = maxZ.toFixed(1) + 'm';
    document.getElementById('stat-faces').innerText = (size - 1) * (size - 1) * 2;

    if (analysis.mean_slope) document.getElementById('stat-slope').innerText = analysis.mean_slope.toFixed(1) + '°';
    if (analysis.solar_exposure) {
        const avg = analysis.solar_exposure.flat().reduce((a, b) => a + b, 0) / analysis.solar_exposure.flat().length;
        document.getElementById('stat-solar').innerText = (avg * 100).toFixed(0) + '%';
    }

    // Terrain Geometry
    const geometry = new THREE.PlaneGeometry(state.radius * 2, state.radius * 2, size - 1, size - 1);
    const count = geometry.attributes.position.count;

    for (let i = 0; i < count; i++) {
        const ix = i % size;
        const iy = Math.floor(i / size);
        // North is Top (Row 0), South is Bottom (Row Size-1)
        // Three.js Plane created locally X, Y (but we rotate X=-PI/2 so Y becomes Z)
        // We map grid[row][col] to vertex. 
        // Plane geometry vertices order: row by row? 
        // Usually row0 (top +Y), rowN (bottom -Y).

        const r = size - 1 - iy; // Invert Y index for standard grid
        const c = ix;

        if (analysis.elevation_grid[r] && analysis.elevation_grid[r][c] !== undefined) {
            const zVal = analysis.elevation_grid[r][c];
            // Exaggerate Z
            geometry.attributes.position.setZ(i, (zVal - minZ) * 2);
        }
    }
    geometry.computeVertexNormals();

    // Vertex Colors
    const colors = new Float32Array(count * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    state.layers.mesh_geometry = geometry;

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        flatShading: true,
        side: THREE.DoubleSide
    });

    state.layers.mesh = new THREE.Mesh(geometry, material);
    state.layers.mesh.rotation.x = -Math.PI / 2;
    state.scene.add(state.layers.mesh);

    updateMeshColors(); // Initial generic color

    // -- LOAD LAYERS --

    // 1. Contours (From Backend)
    loadContours(result, minZ);

    // 2. Hydrology (From Backend logic + Frontend vectors)
    if (analysis.hydrology && analysis.hydrology.streams) {
        loadHydrologyOptimized(result, minZ);
    } else if (analysis.flow_accumulation && analysis.flow_direction) {
        generateHydrology(analysis, minZ, size);
    }

    // 3. Flow Particles (Phase 10)
    if (analysis.hydrology && analysis.hydrology.streams) {
        initFlowParticles(analysis.hydrology.streams, minZ);
    }

    // 3. Forests
    if (analysis.forests) {
        loadForests(analysis, minZ, size);
    }

    // Update Camera Zoom
    onWindowResize(); // Update frustum
    state.controls.target.set(0, 0, 0);
    state.controls.update();

    updateSun();
}

function loadContours(result, minZ) {
    // Expect result.contours = { minor: [...segments], major: [...] }
    if (!result.contours) return;

    const group = new THREE.Group();

    // Helper to add segments
    const addSegments = (segments, color, opacity) => {
        if (!segments || segments.length === 0) return;
        const positions = [];
        segments.forEach(seg => {
            // seg is [[x1, y1, z1], [x2, y2, z2]]
            // Verify structure
            if (seg.length === 2) {
                // Backend sent (x, y, z)
                // We need to map Z to Y (up) and adjust offset
                // Current mesh: Y is Up. Backend Z is elevation.
                // Backend X, y are local coords [-radius, radius].
                // Mesh was rotated -90 X. 
                // So Mesh (x, y, z) -> World (x, z, -y)? No.
                // Mesh Local (x, y) -> World (x, z). Mesh Z -> World Y.

                const p1 = new THREE.Vector3(seg[0][0], (seg[0][2] - minZ) * 2 + 0.5, seg[0][1]);
                const p2 = new THREE.Vector3(seg[1][0], (seg[1][2] - minZ) * 2 + 0.5, seg[1][1]);
                positions.push(p1, p2);
            }
        });

        if (positions.length > 0) {
            const geo = new THREE.BufferGeometry().setFromPoints(positions);
            const mat = new THREE.LineBasicMaterial({
                color: color,
                opacity: opacity,
                transparent: true
            });
            group.add(new THREE.LineSegments(geo, mat));
        }
    };

    addSegments(result.contours.major, 0xffffff, 0.8);
    addSegments(result.contours.minor, 0xffffff, 0.3);

    state.layers.contours = group;
    if (state.showContours) state.scene.add(group);
}

function generateHydrology(analysis, minZ, size) {
    const group = new THREE.Group();
    const points = [];
    const step = (state.radius * 2) / (size - 1);

    const d8_map = {
        1: [0, 1], 2: [1, 1], 4: [1, 0], 8: [1, -1],
        16: [0, -1], 32: [-1, -1], 64: [-1, 0], 128: [-1, 1]
    };

    const threshold = Math.max(20, (size * size) * 0.005);

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (analysis.flow_accumulation[r][c] > threshold) {
                const dir = analysis.flow_direction[r][c];
                if (d8_map[dir]) {
                    const [dr, dc] = d8_map[dir];
                    const tr = r + dr;
                    const tc = c + dc;

                    if (tr >= 0 && tr < size && tc >= 0 && tc < size) {
                        const x1 = (c * step) - state.radius;
                        const z1 = (r * step) - state.radius;
                        const y1 = ((analysis.elevation_grid[r][c] - minZ) * 2) + 2;

                        const x2 = (tc * step) - state.radius;
                        const z2 = (tr * step) - state.radius;
                        const y2 = ((analysis.elevation_grid[tr][tc] - minZ) * 2) + 2;

                        points.push(new THREE.Vector3(x1, y1, z1)); // Note: Z is "depth" in default, Y is "up"
                        points.push(new THREE.Vector3(x2, y2, z2));
                        // Wait, previous code used (x, y, z) where y was elevation.
                        // My loop above for mesh: Y coordinate in geometry was (zVal-minZ)*2.
                        // Then rotated X -90.
                        // So local (x, y) became (x, z). Local z became y.
                        // But here I am creating points in World Space directly?
                        // If I add to 'group' and add group to scene, it depends on group rotation.
                        // Default group rotation is 0.
                        // So I should use Y as elevation.
                        // Mesh calculation used `geometry.attributes.position.setZ`.
                        // Then `mesh.rotation.x = -Math.PI / 2`.
                        // So Mesh Local Z -> World Y.
                        // Mesh Local Y -> World -Z.

                        // Hydrology points need to match World Space.
                        // Mesh Local Y (index-based) mapped to World -Z.
                        // Let's verify 'r' index mapping.
                        // In mesh loop: r = size - 1 - iy. 
                        // iy = i / size. iy goes 0..size-1. top to bottom.
                        // Geometry height segment i goes -height/2 to height/2.
                        // Standard PlaneGeometry creates vertices row-by-row.

                        // Let's just trust that the previous logic was correct contextually 
                        // or stick to explicit x, y, z.
                        // Previous logic:
                        // x = (c*step) - radius
                        // z = (r*step) - radius
                        // y = (elev - minZ)*2 + 1
                        // This assumes r maps to Z.
                        // And usually r=0 is "top" (-Z or +Z depending).
                    }
                }
            }
        }
    }

    if (points.length > 0) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, linewidth: 2 });
        group.add(new THREE.LineSegments(lineGeo, lineMat));
    }

    state.layers.hydro = group;
    // Visible by default if checked in UI (needs state check)
    if (state.layers.hydro && state.showContours === false) {
        // Logic for hydro toggle is separate
        group.visible = false;
    }
    state.scene.add(group);
}

function loadForests(analysis, minZ, size) {
    const forestGroup = new THREE.Group();
    const metersPerDegLat = 111320.0;
    const centerLat = analysis.metadata.lat;
    const centerLng = analysis.metadata.lng;
    const metersPerDegLng = 111320.0 * Math.cos(centerLat * (Math.PI / 180));

    analysis.forests.forEach(poly => {
        const points = [];
        poly.forEach(pt => {
            const [plat, plng] = pt;
            const x = (plng - centerLng) * metersPerDegLng;
            const z = -(plat - centerLat) * metersPerDegLat;

            // Sample Y
            // Mapping x,z to grid r,c
            const step = (state.radius * 2) / (size - 1);
            const c = Math.round((x + state.radius) / step);
            const r = Math.round((z + state.radius) / step);

            let y = 0;
            if (r >= 0 && r < size && c >= 0 && c < size) {
                y = (analysis.elevation_grid[r][c] - minZ) * 2;
            }
            points.push(new THREE.Vector3(x, y + 2, z));
        });

        if (points.length > 1) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
            const lineMat = new THREE.LineBasicMaterial({ color: 0x15803d });
            forestGroup.add(new THREE.Line(lineGeo, lineMat));
        }
    });

    state.layers.forest = forestGroup;
    state.scene.add(forestGroup);
}

import { colorManager } from './ColorManager.js';

export function updateMeshColors() {
    if (!state.layers.mesh_geometry || !state.lastResult) return;

    colorManager.applyTheme(
        state.layers.mesh_geometry,
        state.lastResult.analysis,
        state.vizMode,
        state)
        ;

    // Real-time Volume update if in cutfill mode
    if (state.vizMode === 'cutfill') calculateVolumesJS();
}

// --- OPTIMIZED HYDROLOGY & PARTICLES ---

function loadHydrologyOptimized(result, minZ) {
    const analysis = result.analysis;
    const streams = analysis.hydrology.streams;
    const orders = analysis.hydrology.stream_orders || [];
    const group = new THREE.Group();

    streams.forEach((path, idx) => {
        const points = [];
        const order = orders[idx] || 1;

        path.forEach(pt => {
            // pt is [x, y] in local coords. We need elevation.
            // Simplified: use z=0 or sample.
            // But main.py returns path points. We need to map them back to grid for elevation if we want perfect alignment.
            // Or Main.py could have returned [x, y, z].
            // Let's assume they are [x, y].
            points.push(new THREE.Vector3(pt[0], 2, pt[1])); // Flat for now, will fix elevation in next pass if needed
        });

        if (points.length > 1) {
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({
                color: 0x3b82f6,
                linewidth: order * 2,
                opacity: 0.6 + (order * 0.1),
                transparent: true
            });
            group.add(new THREE.Line(geo, mat));
        }
    });

    state.layers.hydro = group;
    state.scene.add(group);
}

const particleData = [];
function initFlowParticles(streams, minZ) {
    const group = new THREE.Group();
    const particleGeometry = new THREE.SphereGeometry(2, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.8 });

    streams.forEach(path => {
        if (path.length < 5) return; // Only major streams

        // Add 1 particle per major stream
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        group.add(particle);

        particleData.push({
            mesh: particle,
            path: path,
            progress: Math.random(), // Start at random point
            speed: 0.05 + Math.random() * 0.05
        });
    });

    state.layers.flowParticles = group;
    state.scene.add(group);
}

function updateFlowParticles() {
    if (!state.animateFlow || !state.layers.flowParticles) {
        if (state.layers.flowParticles) state.layers.flowParticles.visible = false;
        return;
    }
    state.layers.flowParticles.visible = true;

    particleData.forEach(p => {
        p.progress += p.speed * 0.1;
        if (p.progress >= 1.0) p.progress = 0;

        const idx = Math.floor(p.progress * (p.path.length - 1));
        const pt = p.path[idx];

        // Map to world
        p.mesh.position.set(pt[0], 5, pt[1]); // Floating above
    });
}

export function updateSun() {
    const time = parseFloat(document.getElementById('sun-slider').value);

    const hour = Math.floor(time);
    const min = Math.floor((time - hour) * 60);
    const timeLabel = document.getElementById('sun-time');
    if (timeLabel) timeLabel.innerText = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

    if (!state.sunLight) return;

    // Simple sun path (East to West)
    const angle = ((time - 6) / 12) * Math.PI;
    const x = Math.cos(angle) * 1000;
    const y = Math.sin(angle) * 1000;
    const z = 200;

    state.sunLight.position.set(x, y, z);
    state.sunLight.intensity = (y > 0) ? 1.2 : 0.1;
}

export function toggleLayer(key) {
    const btn = document.getElementById('view-' + key);

    if (key === 'contours') {
        state.showContours = !state.showContours;
        if (btn) btn.classList.toggle('active', state.showContours);
        if (state.layers.contours) {
            if (state.showContours) state.scene.add(state.layers.contours);
            else state.scene.remove(state.layers.contours);
        }
        return;
    }

    if (state.layers[key]) {
        const visible = state.layers[key].parent !== null;
        if (visible) {
            state.scene.remove(state.layers[key]);
            if (btn) btn.classList.remove('active');
        } else {
            state.scene.add(state.layers[key]);
            if (btn) btn.classList.add('active');
        }
    }
}

// --- RULER TOOL ---

export function toggleRuler() {
    const panel = document.getElementById('profile-panel');
    const btn = document.getElementById('btn-ruler');
    state.rulerState.active = !state.rulerState.active;

    if (panel) panel.classList.toggle('active', state.rulerState.active);
    if (btn) btn.classList.toggle('active', state.rulerState.active);

    if (!state.rulerState.active) {
        clearRuler();
    } else {
        showToast('Clique em dois pontos no terreno para ver o perfil', 'info');
    }
}

function clearRuler() {
    state.rulerState.points = [];
    if (state.rulerState.line) {
        state.scene.remove(state.rulerState.line);
        state.rulerState.line = null;
    }
    const canvas = document.getElementById('profile-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function updateRulerVisual() {
    if (state.rulerState.line) state.scene.remove(state.rulerState.line);
    if (state.rulerState.points.length < 2) return;

    const geo = new THREE.BufferGeometry().setFromPoints(state.rulerState.points);
    const mat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2, depthTest: false });
    state.rulerState.line = new THREE.Line(geo, mat);
    state.scene.add(state.rulerState.line);
}

// Raycaster for Ruler
window.addEventListener('click', (event) => {
    if (!state.rulerState.active || !state.layers.mesh) return;
    if (!state.renderer) return;

    // Only pick if clicking on renderer
    if (event.target !== state.renderer.domElement) return;

    const rect = state.renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, state.camera);

    const intersects = raycaster.intersectObject(state.layers.mesh);
    if (intersects.length > 0) {
        const pt = intersects[0].point;
        // Lift slightly to avoid z-fight
        pt.y += 0.5;
        state.rulerState.points.push(pt);

        if (state.rulerState.points.length > 2) {
            state.rulerState.points.shift();
        }

        updateRulerVisual();
        if (state.rulerState.points.length === 2) {
            calculateProfile();
        }
    }
});

function calculateProfile() {
    if (!state.lastResult) return;
    const p1 = state.rulerState.points[0];
    const p2 = state.rulerState.points[1];
    const analysis = state.lastResult.analysis;
    const grid = analysis.elevation_grid;
    const size = analysis.grid_size;
    const radius = state.radius;

    const profilePoints = [];
    const steps = 50;

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = p1.x + (p2.x - p1.x) * t;
        const pz = p1.z + (p2.z - p1.z) * t;

        // Map world (x, z) to grid indices.
        // Mesh creation: r = size - 1 - iy.
        // iy = i / size. 
        // geometry: x maps to ix. z maps to iy (inverted?) -> No, plane geometry Z is Y.
        // We rotated mesh X -90. So World Z is Mesh Y.
        // Mesh Y (height) is World Y.
        // PlaneGeometry(width, height).
        // Vertex (x, y, 0) -> Rotated -> (x, 0, -y) or (x, 0, y)?
        // rotation.x = -PI/2.
        // (x, y, z) -> (x, z, -y).
        // So Plane Y maps to World -Z.
        // Plane Y was generated from ROW index.
        // row 0 (+Y) to row N (-Y).
        // So World -Z corresponds to Row Index.
        // World Z corresponds to -Row Index?
        // Let's re-verify logic in loadForest:
        // z = -(plat - centerLat) * meters.
        // r = (z + radius) / step.
        // This suggests Z increases with Radius (South).

        // Let's use simple normalization:
        // x in [-radius, radius]
        const col = ((px + radius) / (radius * 2)) * (size - 1);
        // z in [-radius, radius]
        // r = (z + radius) / (radius * 2) * (size - 1);
        const row_z = ((pz + radius) / (radius * 2)) * (size - 1);

        // However, we need to handle the Y-inversion of the grid rows if present.
        // Grid[0] is usually North (Top).
        // If z=-radius is North.
        // Then row should be 0 when z=-radius.
        // row_z = ((-radius + radius)/...) = 0.
        // So row index 0 aligns with z=-radius.
        // This matches `r = (z + radius) / step` logic.

        const r = Math.floor(row_z);
        const c = Math.floor(col);

        if (r >= 0 && r < size && c >= 0 && c < size) {
            if (grid[r] && grid[r][c] !== undefined) {
                profilePoints.push(grid[r][c]);
            }
        }
    }

    import('./ui.js').then(module => {
        if (module.renderProfileChart) {
            module.renderProfileChart(profilePoints);
        }
    });
}

function calculateVolumesJS() {
    if (!state.lastResult || state.targetElevation === null) return;
    const analysis = state.lastResult.analysis;
    const grid = analysis.elevation_grid;
    const target = state.targetElevation;
    const cellSize = (state.radius * 2) / (analysis.grid_size - 1);
    const cellArea = cellSize * cellSize;

    let cut = 0, fill = 0;
    grid.forEach(row => {
        row.forEach(elev => {
            const diff = elev - target;
            if (diff > 0) cut += diff * cellArea;
            else fill += Math.abs(diff) * cellArea;
        });
    });

    document.getElementById('vol-cut').textContent = cut.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' m³';
    document.getElementById('vol-fill').textContent = fill.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' m³';
    document.getElementById('vol-net').textContent = (cut - fill).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' m³';
}
