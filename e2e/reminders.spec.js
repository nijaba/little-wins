// The evening reminder's Settings section, and the service worker it needs.
const { test, expect, startFamily, goTab, openFold } = require('./fixtures');

test('E2E-150 Settings offers the evening reminder, and the service worker registers under the CSP', async ({
  page,
}) => {
  await startFamily(page);
  await goTab(page, 'Settings');
  const rem = await openFold(page, 'rem');
  await expect(rem.locator('summary')).toContainText('Evening reminder');
  const supported = await page.evaluate(
    () => 'serviceWorker' in navigator && 'PushManager' in window,
  );
  if (supported) {
    await expect(rem.getByLabel('Remind me at')).toHaveValue('19:30');
    await expect(rem.getByRole('button', { name: 'Remind me on this phone' })).toBeVisible();
    const scope = await page.evaluate(
      async () => (await navigator.serviceWorker.register('/sw.js')).scope,
    );
    expect(scope).toMatch(/\/$/);
  } else {
    await expect(rem).toContainText("This browser can't show reminders.");
  }
});
