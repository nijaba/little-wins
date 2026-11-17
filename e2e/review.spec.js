// The weekly review: opened from the Week tab, printable, and back to the week.
const { test, expect, startFamily, card, goTab } = require('./fixtures');

test('E2E-120 a parent opens the weekly review from Week, prints it, and goes back', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {
      window.__printed = (window.__printed || 0) + 1;
    };
  });
  await startFamily(page, { child: 'Robin' });
  await card(page, 'Tidy room').getByRole('button', { name: '+', exact: true }).click();
  await goTab(page, 'Week');
  await page.getByRole('button', { name: 'Weekly review' }).click();
  await expect(page.getByRole('heading', { name: 'Weekly review: Robin' })).toBeVisible();
  await expect(page.locator('main .card').filter({ hasText: 'Points earned' })).toContainText(
    '+10',
  );
  await expect(page.getByRole('heading', { name: 'Done most often' })).toBeVisible();
  await expect(page.locator('.rv-table tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'Print' }).click();
  expect(await page.evaluate(() => window.__printed)).toBe(1);
  await page.getByRole('button', { name: 'Back to the week' }).click();
  await expect(page.getByRole('heading', { name: 'Weekly challenges' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Weekly review' })).toBeVisible();
});

test('E2E-121 the weekly review fits a phone and its print view hides the buttons and tabs', async ({
  page,
}) => {
  await startFamily(page);
  await goTab(page, 'Week');
  await page.getByRole('button', { name: 'Weekly review' }).click();
  await expect(page.locator('.rv-table')).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(wide, 'no sideways scrolling').toBe(false);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.tabs')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Print' })).toBeHidden();
  await expect(page.locator('.rv-table')).toBeVisible();
});
