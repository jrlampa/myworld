#!/usr/bin/env node

/**
 * Health Check Script for sisRUA Unified Application
 * Tests all critical endpoints and functionality
 */

const https = require('https');
const http = require('http');

const SERVICE_URL = process.env.SERVICE_URL || process.argv[2];
const TIMEOUT = 30000; // 30 seconds

if (!SERVICE_URL) {
  console.error('❌ SERVICE_URL not provided');
  console.error('Usage: node health-check.js <service-url>');
  process.exit(1);
}

console.log(`🏥 Health Check for: ${SERVICE_URL}`);
console.log('================================================\n');

let failedChecks = 0;
let passedChecks = 0;

/**
 * Make HTTP request
 */
function makeRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      method,
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Health-Check-Bot/1.0'
      },
      timeout: TIMEOUT
    };

    if (data) {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = protocol.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({
            statusCode: res.statusCode,
            data: parsed,
            raw: responseData
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: null,
            raw: responseData
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test a single endpoint
 */
async function testEndpoint(name, url, method = 'GET', data = null, expectedStatus = 200) {
  try {
    const startTime = Date.now();
    const response = await makeRequest(url, method, data);
    const duration = Date.now() - startTime;

    if (response.statusCode === expectedStatus) {
      console.log(`✅ ${name}: OK (${duration}ms, HTTP ${response.statusCode})`);
      passedChecks++;
      return true;
    } else {
      console.log(`❌ ${name}: FAILED (HTTP ${response.statusCode}, expected ${expectedStatus})`);
      failedChecks++;
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    failedChecks++;
    return false;
  }
}

/**
 * Run all health checks
 */
async function runHealthChecks() {
  console.log('🔍 Running Health Checks...\n');

  // 1. Health Check Endpoint
  console.log('📋 Basic Health Checks');
  console.log('----------------------');
  await testEndpoint(
    'Health Check Endpoint',
    `${SERVICE_URL}/health`
  );

  // 2. Frontend Loading
  await testEndpoint(
    'Frontend (index.html)',
    `${SERVICE_URL}/`
  );

  // 3. API Endpoints
  console.log('\n📋 API Endpoints');
  console.log('----------------------');
  
  // Search endpoint - using decimal coordinates
  await testEndpoint(
    'Search API (geocoding)',
    `${SERVICE_URL}/api/search`,
    'POST',
    { query: '-23.5505, -46.6333' }
  );

  // Analyze endpoint - basic test
  await testEndpoint(
    'AI Analysis API',
    `${SERVICE_URL}/api/analyze`,
    'POST',
    { 
      stats: { buildings: 10, roads: 5, trees: 20 },
      locationName: 'Test Location'
    }
  );

  // Elevation profile endpoint
  await testEndpoint(
    'Elevation Profile API',
    `${SERVICE_URL}/api/elevation/profile`,
    'POST',
    {
      start: { lat: -23.5505, lng: -46.6333 },
      end: { lat: -23.5506, lng: -46.6334 },
      steps: 10
    }
  );

  // DXF generation endpoint (will create a job)
  await testEndpoint(
    'DXF Generation API',
    `${SERVICE_URL}/api/dxf`,
    'POST',
    {
      lat: -23.5505,
      lon: -46.6333,
      radius: 100,
      mode: 'circle'
    },
    202 // Expect 202 (Accepted) for async job
  );

  // 4. Static Assets
  console.log('\n📋 Static Assets');
  console.log('----------------------');
  await testEndpoint(
    'Theme CSS',
    `${SERVICE_URL}/theme-override.css`
  );

  // 5. API Documentation
  console.log('\n📋 Documentation');
  console.log('----------------------');
  await testEndpoint(
    'Swagger API Docs',
    `${SERVICE_URL}/api-docs/`
  );

  // Summary
  console.log('\n================================================');
  console.log('📊 Health Check Summary');
  console.log('================================================');
  console.log(`✅ Passed: ${passedChecks}`);
  console.log(`❌ Failed: ${failedChecks}`);
  console.log(`📈 Total:  ${passedChecks + failedChecks}`);
  console.log(`📊 Success Rate: ${Math.round((passedChecks / (passedChecks + failedChecks)) * 100)}%`);
  console.log('================================================\n');

  if (failedChecks > 0) {
    console.error(`❌ Health check failed with ${failedChecks} failures`);
    process.exit(1);
  } else {
    console.log('✅ All health checks passed!');
    process.exit(0);
  }
}

// Run the health checks
runHealthChecks().catch((error) => {
  console.error('❌ Health check script error:', error);
  process.exit(1);
});
