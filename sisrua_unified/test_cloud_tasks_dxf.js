// Test script to simulate DXF generation via webhook (bypassing Cloud Tasks in dev)
const axios = require('axios');

// UTM coordinates: 23k 668277 7476679 with 2km radius
// Zone 23K, Easting: 668277, Northing: 7476679
// Need to convert to lat/lon

// For Zone 23S (southern hemisphere), approximately:
// These coordinates are in southern Brazil
// Approximate conversion: lat ≈ -22.5, lon ≈ -47.0

const testPayload = {
    taskId: 'test-' + Date.now(),
    lat: -22.5,  // Approximate from UTM
    lon: -47.0,   // Approximate from UTM
    radius: 2000, // 2km in meters
    mode: 'circle',
    polygon: '[]',
    layers: {},
    projection: 'utm',
    outputFile: '/home/runner/work/myworld/myworld/sisrua_unified/public/dxf/test_utm_' + Date.now() + '.dxf',
    filename: 'test_utm_' + Date.now() + '.dxf',
    cacheKey: 'test-cache-key-' + Date.now(),
    downloadUrl: 'http://localhost:3001/downloads/test_utm_' + Date.now() + '.dxf'
};

console.log('Testing DXF generation with payload:', JSON.stringify(testPayload, null, 2));

// Note: This would normally be called by Cloud Tasks, but we're testing directly
// The webhook endpoint at /api/tasks/process-dxf will handle the generation
console.log('\nPayload ready. Use this with the webhook endpoint.');
console.log('In production, Cloud Tasks will POST to: /api/tasks/process-dxf');

module.exports = testPayload;
