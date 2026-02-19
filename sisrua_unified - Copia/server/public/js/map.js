
import { state } from './state.js';
import { showToast } from './utils.js';

export function initMap() {
    state.map = L.map('map-container', {
        zoomControl: false,
        attributionControl: false
    }).setView([state.lat, state.lng], 15);

    // Esri Satellite
    L.esri.basemapLayer('Imagery').addTo(state.map);
    L.esri.basemapLayer('ImageryLabels').addTo(state.map);

    // Marker & Circle
    state.marker = L.marker([state.lat, state.lng], { draggable: true }).addTo(state.map);
    state.radiusCircle = L.circle([state.lat, state.lng], {
        radius: state.radius,
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.1,
        weight: 2
    }).addTo(state.map);

    // Events
    state.map.on('click', (e) => updateLocation(e.latlng.lat, e.latlng.lng));
    state.marker.on('dragend', (e) => updateLocation(e.target.getLatLng().lat, e.target.getLatLng().lng));

    // Sync Inputs
    const radiusSlider = document.getElementById('radius-slider');
    if (radiusSlider) {
        radiusSlider.addEventListener('input', (e) => {
            const r = parseInt(e.target.value);
            state.radius = r;
            state.radiusCircle.setRadius(r);
            const valEl = document.getElementById('radius-val');
            if (valEl) valEl.innerText = r + 'm';

            const warning = document.getElementById('radius-warning');
            if (warning) {
                if (r >= 2000) warning.innerText = '(!)';
                else warning.innerText = '';
            }
        });
    }

    // Initial input sync
    const latEl = document.getElementById('lat');
    const lngEl = document.getElementById('lng');
    if (latEl) latEl.value = state.lat;
    if (lngEl) lngEl.value = state.lng;

    // --- LEAFLET DRAW SETUP ---
    state.layers.drawLayer = new L.FeatureGroup();
    state.map.addLayer(state.layers.drawLayer);

    const drawControl = new L.Control.Draw({
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: true,
                shapeOptions: {
                    color: '#ec4899',
                    weight: 2
                }
            },
            marker: false,
            circle: false,
            circlemarker: false,
            polyline: false,
            rectangle: true
        },
        edit: {
            featureGroup: state.layers.drawLayer,
            remove: true
        }
    });
    state.map.addControl(drawControl);

    state.map.on(L.Draw.Event.CREATED, function (e) {
        const layer = e.layer;
        state.layers.drawLayer.clearLayers();
        state.layers.drawLayer.addLayer(layer);

        const geojson = layer.toGeoJSON();
        state.customBounds = geojson.geometry.coordinates[0];

        state.radiusCircle.setStyle({ color: '#94a3b8', dashArray: '5, 10' });
        showToast('Custom Area Selected', 'success');
    });

    state.map.on(L.Draw.Event.DELETED, function (e) {
        state.customBounds = null;
        state.radiusCircle.setStyle({ color: '#6366f1', dashArray: null });
    });
}

export function updateLocation(lat, lng) {
    state.lat = lat;
    state.lng = lng;
    state.marker.setLatLng([lat, lng]);
    state.radiusCircle.setLatLng([lat, lng]);

    const latEl = document.getElementById('lat');
    const lngEl = document.getElementById('lng');
    if (latEl) latEl.value = lat.toFixed(5);
    if (lngEl) lngEl.value = lng.toFixed(5);

    state.map.panTo([lat, lng]);
}
