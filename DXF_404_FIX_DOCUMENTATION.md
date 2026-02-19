# DXF Download 404 Error Fix - Documentation

## Problem Summary

Users were experiencing HTTP 404 errors when attempting to download DXF files from the Cloud Run service. Analysis of logs revealed three main issues:

1. **404 Errors**: Files were not found at `/downloads/dxf_*.dxf` endpoints
2. **500 Errors**: The `/api/tasks/process-dxf` webhook was failing
3. **Rate Limiter Warnings**: Express 'trust proxy' validation errors

## Root Cause Analysis

The DXF generation pipeline had several critical issues:

### 1. Job Tracking Failure
- **Issue**: The webhook endpoint assumed jobs were pre-created before execution
- **Impact**: In production mode with Cloud Tasks, jobs are created AFTER the task is queued
- **Result**: `updateJobStatus()` calls failed silently, causing job status to become desynchronized
- **Location**: `server/index.ts` line 445 (webhook endpoint)

### 2. Silent Failures
- **Issue**: Job status service functions didn't log errors when jobs were not found
- **Impact**: Impossible to debug production issues - failures occurred invisibly
- **Result**: Files were generated but not tracked, leading to 404s when users tried to download
- **Location**: `server/services/jobStatusService.ts`

### 3. No Retry Logic
- **Issue**: DXF generation had no timeout or retry mechanism
- **Impact**: Transient failures (API timeouts, network issues) became permanent failures
- **Result**: 500 errors in webhook, files never generated
- **Location**: `server/pythonBridge.ts`

### 4. Rate Limiter Configuration
- **Issue**: Express rate limiter flagged trust proxy configuration
- **Impact**: Security warnings in production logs
- **Location**: `server/middleware/rateLimiter.ts`

## Solutions Implemented

### 1. Webhook Job Creation Fix
**File**: `server/index.ts` (lines 446-449)

```typescript
// Create job if it doesn't exist (Cloud Tasks may invoke webhook before job is created)
if (!getJob(taskId)) {
    createJob(taskId);
    logger.info('Job created in webhook (was not pre-created)', { taskId });
}
```

**Impact**:
- Ensures job exists before status updates
- Works in both synchronous (dev) and asynchronous (production) modes
- Prevents silent failures

### 2. Enhanced Error Logging
**File**: `server/services/jobStatusService.ts`

Added error logging to all job status functions:

```typescript
export function updateJobStatus(id: string, status: JobStatus, progress?: number): void {
    const job = jobs.get(id);
    if (job) {
        // ... update logic ...
    } else {
        logger.error('Cannot update job status: job not found', { jobId: id, status, progress });
    }
}
```

**Impact**:
- Makes debugging production issues possible
- Identifies job tracking failures immediately
- Provides context for error investigation

### 3. Retry Logic with Timeout
**File**: `server/pythonBridge.ts`

Implemented automatic retry mechanism:

```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const generateDxf = async (options: DxfOptions): Promise<string> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await generateDxfInternal(options);
            return result;
        } catch (error: any) {
            lastError = error;
            if (attempt < MAX_RETRIES) {
                await sleep(RETRY_DELAY_MS);
            }
        }
    }
    
    throw new Error(`Failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
};
```

**Impact**:
- Handles transient API failures automatically
- Prevents resource exhaustion from hanging processes
- Improves success rate for DXF generation

### 4. Directory Validation
**Files**: `server/pythonBridge.ts`, `server/index.ts`

Added validation before file operations:

```typescript
// Validate output directory exists
const outputDir = path.dirname(options.outputFile);
if (!existsSync(outputDir)) {
    throw new Error(`Output directory does not exist: ${outputDir}`);
}
```

**Impact**:
- Early detection of configuration issues
- Clear error messages for troubleshooting
- Prevents cryptic Python errors

### 5. Rate Limiter Fix
**File**: `server/middleware/rateLimiter.ts`

```typescript
const dxfRateLimiter = rateLimit({
    // ... other options ...
    validate: { trustProxy: false }, // We handle proxy validation in keyGenerator
});
```

**Impact**:
- Eliminates security warnings
- Acknowledges custom IP handling
- Maintains proper rate limiting

## Testing

### Unit Tests
- Retry logic tested with timeout simulation ✅
- TypeScript compilation verified ✅
- Syntax validation passed ✅

### Flow Tests
- Webhook job creation tested (both scenarios) ✅
- Error logging verified ✅
- Security scan completed (0 vulnerabilities) ✅

### Test Scenarios Covered
1. **Normal Flow**: Job pre-created, webhook succeeds
2. **Bug Scenario**: Job not pre-created, webhook creates it
3. **Retry Flow**: First attempt fails, second succeeds
4. **Timeout Flow**: Process times out, retry succeeds

## Deployment Checklist

Before deploying to production:

- [x] All code changes committed
- [x] Code review completed
- [x] Security scan passed
- [x] Flow tests passed
- [ ] Integration testing in staging environment
- [ ] Monitor Cloud Run logs for 24 hours post-deployment
- [ ] Verify DXF downloads work end-to-end

## Monitoring

After deployment, monitor:

1. **Success Rate**: DXF generation completion rate should improve
2. **Error Logs**: Should see fewer "job not found" errors
3. **Retry Metrics**: Track how often retries are needed
4. **Download 404s**: Should decrease significantly

### Key Metrics to Watch

```bash
# Check for job creation in webhook
gcloud logging read "resource.type=cloud_run_revision AND jsonPayload.message='Job created in webhook'"

# Monitor retry attempts
gcloud logging read "resource.type=cloud_run_revision AND jsonPayload.message='DXF generation succeeded after retry'"

# Check for remaining 404 errors
gcloud logging read "resource.type=cloud_run_revision AND httpRequest.status=404 AND httpRequest.requestUrl=~'/downloads/dxf_'"
```

## Configuration

### Environment Variables
No new environment variables required. Existing variables:
- `PYTHON_COMMAND`: Python executable (default: `python3`)
- `NODE_ENV`: Environment mode (affects job creation flow)
- `GCP_PROJECT`: Cloud Tasks configuration

### Constants (configurable in code)
- `MAX_RETRIES`: 3 attempts before failure
- `RETRY_DELAY_MS`: 2000ms (2 seconds) between retries
- `TIMEOUT_MS`: 300000ms (5 minutes) per attempt

## Rollback Plan

If issues occur post-deployment:

1. Revert to previous revision:
   ```bash
   gcloud run services update-traffic sisrua-app --to-revisions=<previous-revision>=100
   ```

2. Check logs for specific errors:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" --limit 50
   ```

3. If job creation causes issues, the old flow will still work in development mode

## Future Improvements

1. **Persistent Job Storage**: Replace in-memory job storage with Firestore or Redis
2. **Metrics Dashboard**: Add Prometheus/Grafana for retry and success rate monitoring
3. **Circuit Breaker**: Add circuit breaker pattern for external API calls
4. **Configurable Timeouts**: Make timeout and retry values configurable via environment variables

## References

- Issue: DXF download 404 errors in production
- Related Logs: Cloud Run logs from 2026-02-19
- Documentation: `/docs/DXF_GENERATION_FLOW.md` (if exists)
