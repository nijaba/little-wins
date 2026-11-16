const { test, expect, startFamily, goTab, card, nextPoll } = require('./fixtures');

// Pick a week start that leaves future days in the week whatever day the test runs on.
const weekStart = new Date().getDay() === 0 ? 'Sunday' : 'Monday';
const strip = (page) => card(page, 'Morning routine').first().locator('.strip');
// The last tappable day is today.
const today = (page) => strip(page).locator('button.d').last();

test('E2E-40 tapping a day cycles its mark', async ({ page }) => {
  await startFamily(page, { weekStart });
  await goTab(page, 'Week');
  const status = card(page, 'Morning routine').first().locator('small').first();
  await expect(today(page)).toContainText('·');
  await expect(status).toHaveText('0/2 perfect days');
  await today(page).click();
  await expect(today(page)).toContainText('✓');
  await expect(today(page)).toHaveClass(/perfect/);
  await expect(status).toHaveText('1/2 perfect days');
  await expect(page.locator('#toast')).toBeVisible();
  await today(page).click();
  await expect(today(page)).toContainText('~');
  await today(page).click();
  await expect(today(page)).toContainText('✗');
  await expect(status).toContainText('a bad day');
  await today(page).click();
  await expect(today(page)).toContainText('✓');
});

test('E2E-41 future days are shown but cannot be tapped', async ({ page }) => {
  await startFamily(page, { weekStart });
  await goTab(page, 'Week');
  const future = strip(page).locator('.d.fut');
  await expect(future.first()).toBeVisible();
  expect(await future.evaluateAll((els) => els.map((e) => e.tagName))).not.toContain('BUTTON');
  expect(await strip(page).locator('.d').count()).toBe(7);
  const before = await strip(page).textContent();
  await future.first().click({ force: true });
  await expect(page.locator('#toast')).toBeHidden();
  expect(await strip(page).textContent()).toBe(before);
});

test('E2E-42 the previous week can be browsed and marked, and Back returns', async ({ page }) => {
  await startFamily(page, { weekStart });
  await goTab(page, 'Week');
  await expect(page.getByText('This week', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next week' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Back to this week' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(page.getByText(/^Week of /)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next week' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Previous week' })).toBeDisabled();
  // A past week has no future days: every day is tappable.
  await expect(strip(page).locator('button.d')).toHaveCount(7);
  await strip(page).locator('button.d').first().click();
  await expect(strip(page).locator('button.d').first()).toContainText('✓');
  // The view stays on that week.
  await expect(page.getByText(/^Week of /)).toBeVisible();

  await page.getByRole('button', { name: 'Back to this week' }).click();
  await expect(page.getByText('This week', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to this week' })).toHaveCount(0);
  // The mark was made last week: nothing is marked in this one.
  await expect(strip(page).locator('.d.perfect')).toHaveCount(0);

  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(strip(page).locator('.d.perfect')).toHaveCount(1);
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page.getByText('This week', { exact: true })).toBeVisible();
});

test('E2E-43 the selected past week survives the background poll', async ({ page }) => {
  await startFamily(page, { weekStart });
  await goTab(page, 'Week');
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(page.getByText(/^Week of /)).toBeVisible();
  const label = await page.locator('.wnav b').textContent();
  const status = await nextPoll(page);
  expect([200, 304]).toContain(status);
  await expect(page.locator('.wnav b')).toHaveText(label);
  await nextPoll(page);
  await expect(page.locator('.wnav b')).toHaveText(label);
  await expect(page.getByRole('button', { name: 'Back to this week' })).toBeVisible();
});
