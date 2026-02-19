#!/usr/bin/env node

/**
 * Advanced Deployment Error Analysis Script
 * Analyzes deployment failures and suggests fixes
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = process.env.LOG_FILE || process.argv[2];

if (!LOG_FILE || !fs.existsSync(LOG_FILE)) {
  console.error('❌ Log file not provided or does not exist');
  console.error('Usage: node analyze-deployment-error.js <log-file-path>');
  process.exit(1);
}

console.log('🔍 Analyzing Deployment Error Log...\n');

const logContent = fs.readFileSync(LOG_FILE, 'utf8');

// Error patterns and their corresponding fixes
const ERROR_PATTERNS = [
  {
    pattern: /Permission.*denied|PERMISSION_DENIED/i,
    type: 'permissions',
    severity: 'high',
    fixes: [
      'Grant roles/cloudtasks.enqueuer to service account',
      'Grant roles/run.invoker to service account',
      'Verify service account has necessary IAM permissions',
      'Check Workload Identity Federation configuration'
    ],
    automated: true
  },
  {
    pattern: /API.*not enabled|Service.*not enabled/i,
    type: 'api',
    severity: 'high',
    fixes: [
      'Enable Cloud Run API',
      'Enable Cloud Build API',
      'Enable Artifact Registry API',
      'Enable Cloud Tasks API',
      'Enable Cloud Resource Manager API'
    ],
    automated: true
  },
  {
    pattern: /Image.*not found|failed to (build|pull) image/i,
    type: 'build',
    severity: 'high',
    fixes: [
      'Verify Dockerfile exists and is valid',
      'Check package.json and dependencies',
      'Ensure all required files are present',
      'Use --source flag for automatic build',
      'Clear Cloud Build cache'
    ],
    automated: true
  },
  {
    pattern: /Quota exceeded|RESOURCE_EXHAUSTED/i,
    type: 'quota',
    severity: 'medium',
    fixes: [
      'Request quota increase in GCP Console',
      'Wait for quota to reset',
      'Reduce resource requirements',
      'Use different region with available quota'
    ],
    automated: false
  },
  {
    pattern: /timeout|timed out|DEADLINE_EXCEEDED/i,
    type: 'timeout',
    severity: 'medium',
    fixes: [
      'Increase deployment timeout',
      'Optimize build process',
      'Reduce container image size',
      'Check network connectivity'
    ],
    automated: true
  },
  {
    pattern: /does not exist|NOT_FOUND|No such/i,
    type: 'resource',
    severity: 'high',
    fixes: [
      'Create Cloud Tasks queue',
      'Verify project ID is correct',
      'Check region configuration',
      'Ensure service account exists'
    ],
    automated: true
  },
  {
    pattern: /INVALID_ARGUMENT|invalid.*configuration/i,
    type: 'configuration',
    severity: 'high',
    fixes: [
      'Validate environment variables',
      'Check service configuration',
      'Verify memory and CPU settings',
      'Review deployment manifest'
    ],
    automated: false
  },
  {
    pattern: /npm.*error|package.*not found/i,
    type: 'dependencies',
    severity: 'medium',
    fixes: [
      'Run npm install locally to verify',
      'Check package-lock.json is committed',
      'Verify all dependencies are available',
      'Update package versions if needed'
    ],
    automated: false
  },
  {
    pattern: /TypeScript.*error|TS\d{4}/i,
    type: 'typescript',
    severity: 'medium',
    fixes: [
      'Fix TypeScript compilation errors',
      'Update tsconfig.json',
      'Verify type definitions',
      'Run tsc locally to identify issues'
    ],
    automated: false
  },
  {
    pattern: /Docker.*error|dockerfile.*error/i,
    type: 'docker',
    severity: 'high',
    fixes: [
      'Validate Dockerfile syntax',
      'Check base image availability',
      'Verify COPY/ADD paths are correct',
      'Test Docker build locally'
    ],
    automated: false
  }
];

// Analyze the log
const errors = [];
const warnings = [];

ERROR_PATTERNS.forEach(({ pattern, type, severity, fixes, automated }) => {
  const matches = logContent.match(pattern);
  if (matches) {
    errors.push({
      type,
      severity,
      matches: matches[0],
      fixes,
      automated
    });
  }
});

// Additional context analysis
const contextAnalysis = {
  hasDockerfile: logContent.includes('Dockerfile'),
  hasPackageJson: logContent.includes('package.json'),
  hasPermissionError: /permission|unauthorized|forbidden/i.test(logContent),
  hasNetworkError: /network|connection|unreachable/i.test(logContent),
  hasMemoryError: /out of memory|OOM|memory limit/i.test(logContent),
};

// Generate report
console.log('================================================');
console.log('📊 Error Analysis Report');
console.log('================================================\n');

if (errors.length === 0) {
  console.log('✅ No specific error patterns detected');
  console.log('📋 Manual log review recommended\n');
} else {
  console.log(`🔴 Found ${errors.length} error pattern(s):\n`);
  
  errors.forEach((error, index) => {
    console.log(`${index + 1}. ${error.type.toUpperCase()}`);
    console.log(`   Severity: ${error.severity}`);
    console.log(`   Match: "${error.matches.substring(0, 100)}..."`);
    console.log(`   Automated Fix: ${error.automated ? '✅ Yes' : '❌ No'}`);
    console.log(`   Suggested Fixes:`);
    error.fixes.forEach((fix, i) => {
      console.log(`      ${i + 1}. ${fix}`);
    });
    console.log('');
  });
}

// Context information
console.log('================================================');
console.log('📋 Context Analysis');
console.log('================================================\n');
console.log(`Dockerfile mentioned: ${contextAnalysis.hasDockerfile ? '✅' : '❌'}`);
console.log(`package.json mentioned: ${contextAnalysis.hasPackageJson ? '✅' : '❌'}`);
console.log(`Permission issues: ${contextAnalysis.hasPermissionError ? '⚠️ Yes' : '✅ No'}`);
console.log(`Network issues: ${contextAnalysis.hasNetworkError ? '⚠️ Yes' : '✅ No'}`);
console.log(`Memory issues: ${contextAnalysis.hasMemoryError ? '⚠️ Yes' : '✅ No'}`);
console.log('');

// Prioritized recommendations
console.log('================================================');
console.log('🎯 Prioritized Recommendations');
console.log('================================================\n');

const automatedFixes = errors.filter(e => e.automated);
const manualFixes = errors.filter(e => !e.automated);

if (automatedFixes.length > 0) {
  console.log('🤖 Automated Fixes Available:');
  automatedFixes.forEach((error, index) => {
    console.log(`   ${index + 1}. ${error.type}: ${error.fixes[0]}`);
  });
  console.log('');
}

if (manualFixes.length > 0) {
  console.log('👤 Manual Intervention Required:');
  manualFixes.forEach((error, index) => {
    console.log(`   ${index + 1}. ${error.type}: ${error.fixes[0]}`);
  });
  console.log('');
}

// Output JSON for workflow consumption
const result = {
  errors,
  contextAnalysis,
  automatedFixesAvailable: automatedFixes.length > 0,
  manualInterventionRequired: manualFixes.length > 0,
  primaryErrorType: errors.length > 0 ? errors[0].type : 'unknown',
  canAutoHeal: automatedFixes.length > 0
};

// Write JSON output
const outputPath = process.env.OUTPUT_JSON || '/tmp/error-analysis.json';
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

console.log('================================================');
console.log(`📄 Analysis saved to: ${outputPath}`);
console.log('================================================\n');

// Exit with appropriate code
if (errors.length > 0 && automatedFixes.length === 0) {
  console.error('❌ Manual intervention required - no automated fixes available');
  process.exit(2);
} else if (errors.length > 0) {
  console.log('✅ Automated fixes available - proceeding with healing');
  process.exit(0);
} else {
  console.log('⚠️ No specific errors detected - manual review needed');
  process.exit(1);
}
