import { _electron as electron, test, expect } from '@playwright/test';
import path from 'path';

test('launch app and verify title', async () => {
  // Launch Electron app
  const app = await electron.launch({
    args: [path.join(__dirname, '..')], // Point to root where package.json is
  });

  // Get the first window
  const window = await app.firstWindow();
  console.log('Window acquired');

  // Verify title (might need to wait for load)
  await window.waitForLoadState('domcontentloaded');
  console.log('Window loaded');

  try {
    // Check window title from <title> tag
    const pageTitle = await window.title();
    console.log(`Page title: ${pageTitle}`);

    // Wait for app-title
    // Make sure the selector matches App.tsx: <h1 className="app-title">
    const appTitle = window.locator('.app-title');
    await expect(appTitle).toHaveText('OSM to CAD', { timeout: 10000 });
    console.log('App title verified');

  } catch (e: any) {
    console.log("Test failed, dumping HTML content:");
    // Use evaluate to get innerHTML of body
    const content = await window.evaluate(() => document.body.innerHTML);
    console.log(content);
    throw e;
  }

  // Close app
  await app.close();
});
