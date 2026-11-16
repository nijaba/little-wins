const { test, expect, startFamily, header, goTab, fold, openFold, card } = require('./fixtures');

const EVIL = '<img src=x onerror=alert(1)> & "q"';

test('E2E-20 user-entered names render as text everywhere', async ({ page }) => {
  await startFamily(page, { child: EVIL, family: EVIL });
  await goTab(page, 'Settings');

  // A behavior and a reward named with markup.
  const beh = await openFold(page, 'target');
  await beh.getByRole('button', { name: '+ Add' }).click();
  await page.getByLabel('Name', { exact: true }).fill(EVIL);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(beh).toContainText(EVIL);
  const rew = await openFold(page, 'rew');
  await rew.getByRole('button', { name: '+ Add' }).click();
  await page.getByLabel('Name', { exact: true }).fill(EVIL);
  await page.getByLabel('Stars needed').fill('1');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(rew).toContainText(EVIL);

  // Settings: behavior, reward, family name, child name.
  await expect(fold(page, 'fam').locator('.cnt')).toHaveText(EVIL);
  await expect(fold(page, 'kids')).toContainText(EVIL);
  await expect(page.locator('#app img')).toHaveCount(0);

  // Today: the behavior, and record it so History and the toast have the name too.
  await goTab(page, 'Today');
  await expect(page.locator('main')).toContainText(EVIL);
  await card(page, EVIL).getByRole('button', { name: '+', exact: true }).click();
  await expect(header(page)).toHaveText('5 pts · 0 ★');
  await expect(page.locator('#toast')).toContainText(EVIL);
  await expect(page.locator('#toast img')).toHaveCount(0);

  await goTab(page, 'Rewards');
  await expect(page.locator('main')).toContainText(EVIL);
  await goTab(page, 'History');
  await expect(page.locator('main')).toContainText(EVIL);

  await expect(page.locator('#app img, #toast img')).toHaveCount(0);
  // Nothing was injected: the page holds the text, not an element built from it.
  expect(await page.evaluate(() => document.querySelectorAll('[onerror]').length)).toBe(0);
});
