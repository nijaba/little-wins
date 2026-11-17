// Browser tests. Every test starts its own app server (see e2e/fixtures.js), so there is no
// webServer entry here. Two projects: a Chromium phone and WebKit as an iPhone.
const { defineConfig, devices } = require('@playwright/test');

const ci = !!process.env.CI;

module.exports = defineConfig({
  // CI runners are much slower than a laptop: give each test more room there.
  timeout: ci ? 60_000 : 30_000,
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, hasTouch: true },
    },
    { name: 'webkit', use: { ...devices['iPhone 13'] } },
  ],
});
