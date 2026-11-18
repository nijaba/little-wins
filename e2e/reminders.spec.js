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

test('E2E-151 a parent turns notices on and off for a child in Settings -> Children', async ({
  page,
}) => {
  await startFamily(page, { child: 'Robin' });
  await goTab(page, 'Settings');
  const kids = await openFold(page, 'kids');
  const bell = kids.locator('[data-action=notify]');
  await expect(bell).toHaveText('🔔 Notices on their device: off');
  await expect(bell).toHaveAttribute('aria-pressed', 'false');
  await bell.click();
  await expect(bell).toHaveText('🔔 Notices on their device: on');
  await expect(bell).toHaveAttribute('aria-pressed', 'true');
  await bell.click();
  await expect(bell).toHaveText('🔔 Notices on their device: off');
});
