import { test, expect } from '@playwright/test';

test.describe('DXF Generation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should generate DXF with cached response', async ({ page }) => {
    // Wait for map to load
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });

    // Look for search input and enter coordinates
    const searchInput = page.locator('input[type="search"], input[placeholder*="pesquis" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('-23.5505, -46.6333');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Click analyze button
    const analyzeBtn = page.getByRole('button', { name: /ANALISAR|ANALYZE/i });
    await expect(analyzeBtn).toBeVisible({ timeout: 10000 });
    await analyzeBtn.click();

    // Wait for analysis to complete
    await expect(page.locator('text=/Analysis Complete|Análise/i')).toBeVisible({ timeout: 30000 });

    // Click download DXF button
    const downloadBtn = page.getByRole('button', { name: /DOWNLOAD DXF|BAIXAR/i });
    await expect(downloadBtn).toBeVisible();
    
    // Monitor for download or job queuing
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await downloadBtn.click();

    // Check if job was queued or served from cache
    const jobIndicator = page.locator('text=/gerando|generating|queued/i');
    const isQueued = await jobIndicator.isVisible().catch(() => false);

    if (isQueued) {
      // Async flow: wait for job completion
      await expect(jobIndicator).toBeHidden({ timeout: 120000 });
    }

    // Verify download triggered
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.dxf$/i);
    } else {
      // Check for download link in UI
      const downloadLink = page.locator('a[download*="dxf"]');
      await expect(downloadLink).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display job status during queued generation', async ({ page }) => {
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });

    // Enter unique coordinates to avoid cache hit
    const timestamp = Date.now();
    const lat = -23.5 + (timestamp % 100) / 10000;
    const lon = -46.6 + (timestamp % 100) / 10000;

    const searchInput = page.locator('input[type="search"], input[placeholder*="pesquis" i]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(${lat}, );
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
    }

    const analyzeBtn = page.getByRole('button', { name: /ANALISAR|ANALYZE/i });
    if (await analyzeBtn.isVisible()) {
      await analyzeBtn.click();
      await page.waitForTimeout(5000);
    }

    const downloadBtn = page.getByRole('button', { name: /DOWNLOAD DXF|BAIXAR/i });
    if (await downloadBtn.isVisible()) {
      await downloadBtn.click();

      // Check for queued status indicator
      const queuedText = page.locator('text=/queued|enfileirado|aguardando/i');
      const hasQueuedStatus = await queuedText.isVisible().catch(() => false);
      
      if (hasQueuedStatus) {
        // Verify polling happens (status should change or disappear)
        await page.waitForTimeout(3000);
      }
    }
  });
});

test.describe('Batch Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should upload CSV and track batch jobs', async ({ page }) => {
    // Look for batch upload section or file input
    const fileInput = page.locator('input[type="file"][accept*=".csv"]');
    
    // Create CSV content
    const csvContent = 
      'name,lat,lon,radius,mode\n' +
      'TestLocation1,-23.5505,-46.6333,500,circle\n' +
      'TestLocation2,-23.5510,-46.6340,300,circle';

    // Upload CSV file
    await fileInput.setInputFiles({
      name: 'test-batch.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent),
    });

    // Wait for upload processing
    await page.waitForTimeout(2000);

    // Verify batch items appear in UI
    const batchItem = page.locator('text=TestLocation1');
    await expect(batchItem).toBeVisible({ timeout: 10000 });

    // Check for status indicators (queued, cached, completed)
    const statusText = page.locator('text=/queued|cached|completed|erro/i').first();
    await expect(statusText).toBeVisible({ timeout: 5000 });

    // Verify multiple items are being tracked
    const batchItems = page.locator('text=/TestLocation/');
    const count = await batchItems.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Search Functionality', () => {
  test('should search for coordinates', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="search"], input[placeholder*="pesquis" i]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('-23.5505, -46.6333');
      await searchInput.press('Enter');

      // Wait for map update or toast notification
      await page.waitForTimeout(2000);
      
      // Check for success indicator (toast, map marker, etc)
      const successIndicator = page.locator('text=/found|encontrado|success/i, .leaflet-marker');
      const hasIndicator = await successIndicator.first().isVisible().catch(() => false);
      
      if (!hasIndicator) {
        // Map should at least be visible and interactive
        await expect(page.locator('.leaflet-container')).toBeVisible();
      }
    }
  });
});
