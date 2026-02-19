
export const state = {
    // Location
    lat: -22.15018,
    lng: -42.92185,
    radius: 500,

    // Map & Three.js instances
    map: null,
    marker: null,
    radiusCircle: null,
    scene: null,
    camera: null,
    renderer: null,
    controls: null,

    // Job execution
    jobId: null,
    pollInterval: null,
    lastResult: null,

    // Visualization
    vizMode: 'natural', // natural, elevation, slope, solar, aspect, watershed, tpi, tri, landform, cutfill
    showContours: false,
    showWatersheds: false,
    animateFlow: true,

    // Earthworks State (Phase 11)
    targetElevation: null,
    earthworksResult: null,

    // Layer Groups
    layers: {
        mesh: null,
        wire: null,
        hydro: null,
        forest: null,
        contours: null,
        ruler: null,
        drawLayer: null,
        watersheds: null,
        flowParticles: null
    },

    // Lighting
    sunLight: null,

    // Tools
    rulerState: {
        active: false,
        points: [],
        line: null
    },

    // Advanced
    customBounds: null, // GeoJSON Polygon

    // Helpers
    meshGeometry: null // Helper for fast attribute access
};
