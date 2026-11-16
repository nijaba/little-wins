const { test, expect, expectDialog, startFamily, header, card, goTab } = require('./fixtures');

const toast = (page) => page.locator('#toast');
const plus = (page, name) => card(page, name).getByRole('button', { name: '+', exact: true });

test('E2E-10 a fixed behavior adds points, with a toast and Undo', async ({ page }) => {
  await startFamily(page);
  await plus(page, 'Tidy room').click();
  await expect(header(page)).toHaveText('10 pts · 0 ★');
  await expect(toast(page)).toContainText('+10 · Tidy room');
  await toast(page).getByRole('button', { name: 'Undo' }).click();
  await expect(header(page)).toHaveText('0 pts · 0 ★');
  await expect(toast(page)).toBeHidden();
});

test('E2E-11 a ranged behavior asks for the points in a prompt', async ({ page }) => {
  await startFamily(page);
  const asked = expectDialog(page, '12');
  await plus(page, 'Help with a family chore').click();
  const d = await asked;
  expect(d.type).toBe('prompt');
  expect(d.message).toBe('Points (5-15)');
  expect(d.defaultValue).toBe('5');
  await expect(header(page)).toHaveText('12 pts · 0 ★');
  await expect(toast(page)).toContainText('+12 · Help with a family chore');
});

test('E2E-12 cancelling the points prompt records nothing', async ({ page }) => {
  await startFamily(page);
  const asked = expectDialog(page, false);
  await plus(page, 'Help with a family chore').click();
  await asked;
  await expect(header(page)).toHaveText('0 pts · 0 ★');
  await expect(toast(page)).toBeHidden();
  await goTab(page, 'History');
  await expect(page.locator('main .card')).toHaveCount(0);
});

test('E2E-13 a penalty asks to confirm before it takes points away', async ({ page }) => {
  await startFamily(page);
  const earn = expectDialog(page, '15');
  await plus(page, 'Help with a family chore').click();
  await earn;
  await expect(header(page)).toHaveText('15 pts · 0 ★');
  const penalty = card(page, 'Hitting or hurting someone').getByRole('button', {
    name: '-50',
    exact: true,
  });
  // Declined: nothing changes.
  const no = expectDialog(page, false);
  await penalty.click();
  expect((await no).message).toBe('Record penalty: Hitting or hurting someone?');
  await expect(header(page)).toHaveText('15 pts · 0 ★');
  // Confirmed: the balance never goes below 0.
  const yes = expectDialog(page, true);
  await penalty.click();
  await yes;
  await expect(header(page)).toHaveText('0 pts · 0 ★');
  await expect(toast(page)).toContainText('Hitting or hurting someone');
  await toast(page).getByRole('button', { name: 'Undo' }).click();
  await expect(header(page)).toHaveText('15 pts · 0 ★');
});

test('E2E-14 the warning counter goes up and Undo takes it back', async ({ page }) => {
  await startFamily(page);
  const warn = card(page, 'Homework 30 min').locator('button.w');
  await expect(warn).toHaveText('⚠0/2');
  await warn.click();
  await expect(warn).toHaveText('⚠1/2');
  await expect(toast(page)).toContainText('⚠ Warning · Homework 30 min');
  await expect(header(page)).toHaveText('0 pts · 0 ★');
  await toast(page).getByRole('button', { name: 'Undo' }).click();
  await expect(warn).toHaveText('⚠0/2');
});

test('E2E-15 History lists what was recorded and undo from History works', async ({ page }) => {
  await startFamily(page);
  await plus(page, 'Tidy room').click();
  await expect(header(page)).toHaveText('10 pts · 0 ★');
  await goTab(page, 'History');
  const entry = page.locator('main .card').filter({ hasText: 'Tidy room' });
  await expect(entry).toContainText('+10');
  await entry.getByRole('button', { name: 'undo' }).click();
  await expect(header(page)).toHaveText('0 pts · 0 ★');
  await expect(page.locator('main .card').filter({ hasText: 'Tidy room' })).toHaveCount(0);
});
