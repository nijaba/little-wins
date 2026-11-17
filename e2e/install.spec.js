// Adding Little Wins to the home screen: the install banner, the iPhone tips, the shortcuts.
const { test, expect, startFamily, goTab } = require('./fixtures');

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

// Android Chrome: the browser that sends the install offer (iPhone never does).
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

test.describe('on Android', () => {
  test.use({ userAgent: ANDROID });

  test('E2E-220 where the browser offers it, Today shows Install; it opens the install dialog, and Not now sticks', async ({
    page,
  }) => {
    await startFamily(page);
    // A stand-in for the browser's install offer (beforeinstallprompt).
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => {
        window.__prompted = (window.__prompted || 0) + 1;
      };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
    const banner = page.locator('.card.install');
    await expect(banner).toContainText('Add Little Wins to your home screen');
    await banner.getByRole('button', { name: 'Install' }).click();
    expect(await page.evaluate(() => window.__prompted)).toBe(1);
    await expect(banner).toHaveCount(0, { timeout: 2000 });
    // Offered again later, then turned down for good.
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => {};
      e.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(e);
    });
    await banner.getByRole('button', { name: 'Not now' }).click();
    await page.reload();
    await expect(page.locator('header b')).toBeVisible();
    await expect(page.locator('.card.install')).toHaveCount(0);
  });
});

test.describe('on an iPhone', () => {
  test.use({ userAgent: IPHONE });

  test('E2E-221 iPhone gets the Share → Add to Home Screen hint, and the code screen says to install first', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('.ios-tip')).toContainText(
      'add Little Wins to the Home Screen first',
    );
    await startFamily(page);
    await expect(page.locator('.card.install')).toContainText(
      'tap Share ⬆️, then “Add to Home Screen”',
    );
  });
});

test('E2E-222 a home-screen shortcut opens its tab (/?tab=week)', async ({ page }) => {
  await startFamily(page);
  await page.goto('/?tab=week');
  await expect(page.getByRole('heading', { name: 'Weekly challenges' })).toBeVisible();
  await goTab(page, 'Today');
});
