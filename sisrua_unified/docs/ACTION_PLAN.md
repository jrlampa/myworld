# Action Plan - Audit Remediation
## sisRUA Unified - Prioritized Tasks

**Created:** February 16, 2026  
**Target Completion:** March 16, 2026 (4 weeks)

---

## Overview

This action plan addresses findings from the comprehensive audit. Tasks are prioritized by impact and effort, organized into 4 weekly sprints.

---

## Sprint 1: Critical Fixes (Week 1) 🔴

### Goal: Fix broken tests and establish code quality baseline

#### Task 1.1: Fix Python Test Failures
**Priority:** CRITICAL  
**Effort:** 4 hours  
**Owner:** Backend Developer

**Sub-tasks:**
- [ ] Update layer name tests to expect `sisRUA_` prefix
  ```python
  # tests/test_infra.py
  assert layer == 'sisRUA_INFRA_POWER_HV'  # Not 'INFRA_POWER_HV'
  ```
- [ ] Fix or skip broken street label tests (investigate why labels not generated)
- [ ] Fix elevation API mock to match actual implementation
- [ ] Update spatial audit message assertion
- [ ] Run full test suite and verify 100% pass rate

**Acceptance Criteria:**
- All 21 Python tests passing
- No test skip/xfail markers
- CI pipeline green (if exists)

---

#### Task 1.2: Fix Bare Exception Handlers
**Priority:** HIGH  
**Effort:** 1 hour  
**Owner:** Backend Developer

**Files to Fix:**
```python
# py_engine/dxf_generator.py:689
try:
    layout.add_text(...)
except Exception as e:
    Logger.warn(f"Failed to add horizontal tick: {e}")

# py_engine/dxf_generator.py:700
try:
    layout.add_text(...)
except Exception as e:
    Logger.warn(f"Failed to add vertical tick: {e}")

# py_engine/dxf_generator.py:789
try:
    layout.add_blockref('LOGO', ...)
except Exception as e:
    Logger.warn(f"Failed to add logo to layout: {e}")
```

**Acceptance Criteria:**
- No `except: pass` statements remain
- Bandit scan shows 0 bare exception warnings
- Error messages logged for debugging

---

#### Task 1.3: Update npm Dependencies
**Priority:** HIGH  
**Effort:** 2 hours  
**Owner:** Frontend Developer

**Commands:**
```bash
# Update to latest compatible versions
npm update

# Fix esbuild vulnerability (requires vitest v4)
npm audit fix --force

# Verify no breaking changes
npm run test:frontend
npm run build
```

**Acceptance Criteria:**
- `npm audit` shows 0 vulnerabilities
- All frontend tests still passing
- Build successful with no new warnings

---

## Sprint 2: Testing Improvements (Week 2) 🧪

### Goal: Increase test coverage to production-ready levels

#### Task 2.1: Add Backend Integration Tests
**Priority:** HIGH  
**Effort:** 8 hours  
**Owner:** Backend Developer

**Create Test Files:**
```
server/tests/
├── api.test.ts          # Endpoint tests
├── pythonBridge.test.ts # Python integration
└── setup.ts             # Test configuration
```

**Coverage Targets:**
```typescript
// server/tests/api.test.ts
describe('POST /api/dxf', () => {
  it('should generate DXF for valid circle', async () => {
    const response = await request(app)
      .post('/api/dxf')
      .send({ lat: 48.8584, lon: 2.2945, radius: 500, mode: 'circle' });
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.url).toContain('.dxf');
  });

  it('should reject invalid coordinates', async () => {
    const response = await request(app)
      .post('/api/dxf')
      .send({ lat: 999, lon: 999, radius: 500 });
    
    expect(response.status).toBe(400);
  });
});
```

**Acceptance Criteria:**
- 80%+ backend code coverage
- All API endpoints tested (success + error cases)
- Python bridge integration verified

---

#### Task 2.2: Increase Frontend Component Coverage
**Priority:** MEDIUM  
**Effort:** 12 hours  
**Owner:** Frontend Developer

**Priority Components:**
1. **App.tsx** (main orchestration)
2. **MapSelector.tsx** (core functionality)
3. **Dashboard.tsx** (user interface)
4. **SettingsModal.tsx** (configuration)

**Example Test:**
```typescript
// tests/components/MapSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import MapSelector from '../../src/components/MapSelector';

describe('MapSelector', () => {
  it('should render map and controls', () => {
    render(<MapSelector {...mockProps} />);
    expect(screen.getByText(/select area/i)).toBeInTheDocument();
  });

  it('should allow polygon drawing', () => {
    const onPolygonChange = jest.fn();
    render(<MapSelector onPolygonChange={onPolygonChange} />);
    
    const polygonBtn = screen.getByRole('button', { name: /polygon/i });
    fireEvent.click(polygonBtn);
    
    // Simulate polygon drawing...
    expect(onPolygonChange).toHaveBeenCalled();
  });
});
```

**Acceptance Criteria:**
- Overall frontend coverage: 80%+
- Components coverage: 70%+
- Hooks coverage: 90%+ (already at 31%)

---

#### Task 2.3: Add E2E Tests (Optional)
**Priority:** LOW  
**Effort:** 16 hours  
**Owner:** QA/Developer

**Tools:** Playwright or Cypress

**Critical Flows:**
1. Search location → Select area → Generate DXF
2. Import KML → Generate DXF
3. Configure settings → Save project → Load project

**Acceptance Criteria:**
- 5+ E2E tests covering happy paths
- Tests run in CI pipeline
- Screenshots on failure

---

## Sprint 3: Performance Optimization (Week 3) ⚡

### Goal: Optimize bundle size and API performance

#### Task 3.1: Implement Code Splitting
**Priority:** HIGH  
**Effort:** 6 hours  
**Owner:** Frontend Developer

**Changes:**
```typescript
// src/App.tsx - Lazy load heavy components
import React, { Suspense, lazy } from 'react';

const MapSelector = lazy(() => import('./components/MapSelector'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {/* Component usage */}
    </Suspense>
  );
}
```

```typescript
// vite.config.ts - Manual chunks
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'map-vendor': ['leaflet', 'react-leaflet'],
          'chart-vendor': ['recharts'],
          'utils': ['date-fns', 'lodash']
        }
      }
    },
    chunkSizeWarningLimit: 500  // Warn above 500KB
  }
});
```

**Acceptance Criteria:**
- Main bundle < 300KB (currently 915KB)
- Initial load time reduced by 40%+
- No build warnings about chunk size
- Lighthouse performance score 90+

---

#### Task 3.2: Add API Response Caching
**Priority:** MEDIUM  
**Effort:** 4 hours  
**Owner:** Backend Developer

**Implementation:**
```typescript
// server/cache.ts
import NodeCache from 'node-cache';

export const osmCache = new NodeCache({
  stdTTL: 3600,  // 1 hour
  checkperiod: 600  // Check for expired keys every 10min
});

// server/index.ts
app.post('/api/dxf', async (req, res) => {
  const cacheKey = `${lat}_${lon}_${radius}_${mode}`;
  
  const cached = osmCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  
  const result = await generateDxf(...);
  osmCache.set(cacheKey, result);
  
  res.json(result);
});
```

**Acceptance Criteria:**
- Repeated requests 10x faster
- Cache hit rate > 60% in typical usage
- Memory usage monitored (max 100MB cache)

---

#### Task 3.3: Optimize Python Processing
**Priority:** LOW  
**Effort:** 8 hours  
**Owner:** Backend Developer

**Optimizations:**
1. **Profile memory usage:** Identify bottlenecks
2. **Parallel processing:** Use multiprocessing for large areas
3. **Optimize spatial operations:** Pre-filter before intersections

**Acceptance Criteria:**
- Large polygon (5km radius) processes 30% faster
- Memory usage reduced by 20%
- No regressions in output quality

---

## Sprint 4: Production Readiness (Week 4) 🚀

### Goal: Secure and document for production deployment

#### Task 4.1: Production Security Hardening
**Priority:** CRITICAL  
**Effort:** 6 hours  
**Owner:** Backend Developer

**Changes:**
```typescript
// server/index.ts
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

// Install dependencies
// npm install helmet express-rate-limit

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    }
  }
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Environment Variables:**
```bash
# .env.example
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com
GROQ_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
NODE_ENV=production
PORT=3001
```

**Acceptance Criteria:**
- CORS restricted to specific origins
- Rate limiting active (test with >100 requests)
- Security headers present (verify with securityheaders.com)
- No secrets in environment files

---

#### Task 4.2: Create Deployment Documentation
**Priority:** HIGH  
**Effort:** 4 hours  
**Owner:** DevOps/Lead Developer

**Create:**
```
docs/
├── DEPLOYMENT.md        # Production deployment guide
├── ENVIRONMENT.md       # Environment variables reference
└── ARCHITECTURE.md      # System architecture diagrams
```

**Content for DEPLOYMENT.md:**
```markdown
# Deployment Guide

## Prerequisites
- Node.js 18+
- Python 3.10+
- 2GB RAM minimum
- 10GB disk space

## Production Setup

### 1. Environment Configuration
cp .env.example .env
# Edit .env with production values

### 2. Install Dependencies
npm install --production
pip install -r py_engine/requirements.txt

### 3. Build Frontend
npm run build

### 4. Start Server
NODE_ENV=production npm run server

### 5. Reverse Proxy (Nginx)
[Include nginx config]

## Docker Deployment
[Include Dockerfile and docker-compose.yml]

## CI/CD
[GitHub Actions workflow]
```

**Acceptance Criteria:**
- Deployment tested on clean Ubuntu 22.04
- All steps documented and verified
- Docker image builds successfully
- CI/CD pipeline functional

---

#### Task 4.3: Add Health Monitoring
**Priority:** MEDIUM  
**Effort:** 4 hours  
**Owner:** Backend Developer

**Implementation:**
```typescript
// server/health.ts
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    python: boolean;
    osm: boolean;
    cache: boolean;
  };
  metrics: {
    requestsTotal: number;
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

app.get('/health', async (_req, res) => {
  const health = await checkHealth();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/metrics', (_req, res) => {
  // Prometheus-compatible metrics
  res.set('Content-Type', 'text/plain');
  res.send(prometheusRegistry.metrics());
});
```

**Acceptance Criteria:**
- `/health` endpoint returns detailed status
- `/metrics` provides Prometheus metrics
- Alerts configured for degraded status
- Dashboard visualizes health metrics

---

## Progress Tracking

### Completion Checklist

#### Week 1: Critical Fixes
- [ ] Python tests: 21/21 passing
- [ ] Bare exception handlers fixed
- [ ] NPM vulnerabilities: 0
- [ ] ESLint configuration added

#### Week 2: Testing
- [ ] Backend test coverage: 80%+
- [ ] Frontend component coverage: 70%+
- [ ] E2E tests: 5+ critical flows

#### Week 3: Performance
- [ ] Bundle size: < 300KB per chunk
- [ ] API caching: Hit rate 60%+
- [ ] Build warnings: 0

#### Week 4: Production
- [ ] Security hardening complete
- [ ] Deployment docs written
- [ ] Health monitoring active
- [ ] Production deployment successful

---

## Metrics & KPIs

### Before Audit
- **Test Coverage:** 7.57%
- **Python Tests Passing:** 38%
- **Bundle Size:** 915KB
- **NPM Vulnerabilities:** 5
- **Security Score:** 85/100

### Target After Remediation
- **Test Coverage:** 80%+ ✅
- **Python Tests Passing:** 100% ✅
- **Bundle Size:** <300KB ✅
- **NPM Vulnerabilities:** 0 ✅
- **Security Score:** 95/100 ✅

---

## Risk Management

### High Risk
- **Python test fixes may uncover bugs** → Allocate extra QA time
- **Code splitting may break lazy loading** → Test thoroughly

### Medium Risk
- **Vitest v4 upgrade may have breaking changes** → Review changelog
- **Rate limiting may block legitimate users** → Monitor and tune

### Low Risk
- **Documentation may become outdated** → Schedule quarterly reviews
- **Cache may grow too large** → Implement size limits

---

## Communication Plan

### Weekly Standup Topics
1. **Monday:** Sprint planning, task assignment
2. **Wednesday:** Progress check, blocker resolution
3. **Friday:** Demo completed work, retrospective

### Deliverables
- **Week 1:** Fixed tests, clean audit report
- **Week 2:** Test coverage report
- **Week 3:** Performance metrics comparison
- **Week 4:** Production deployment confirmation

---

## Success Criteria

✅ **All tests passing** (frontend + backend + Python)  
✅ **0 critical/high vulnerabilities**  
✅ **80%+ code coverage**  
✅ **Production deployment successful**  
✅ **Security score 95+/100**  
✅ **Bundle size optimized (<300KB)**  
✅ **Documentation complete**

---

**Plan Owner:** Development Team  
**Review Date:** March 16, 2026  
**Next Audit:** June 16, 2026
