// History grouped by day: the day's points in its header, and the best moment on top.
const { test, expect, startFamily, goTab, card, expectDialog } = require('./fixtures');

const plus = (page, name) => card(page, name).getByRole('button', { name: '+', exact: true });

test('E2E-210 History groups entries under Today with its points, and puts the best moment on top', async ({
  page,
}) => {
  await startFamily(page);
  await plus(page, 'Reading 20 min').click(); // +5
  await expect(page.locator('#toast')).toBeVisible();
  await plus(page, 'Tidy room').click(); // +10, the best moment
  await expect(page.locator('header b')).toHaveText('15 pts · 0 ★');
  const confirmed = expectDialog(page, true);
  await card(page, 'Unkind or rude words').getByRole('button').click(); // a penalty
  await confirmed;
  await plus(page, 'Reading 20 min').click(); // +5, the latest
  await goTab(page, 'History');
  const head = page.locator('.day-head').first();
  await expect(head).toContainText('Today');
  await expect(head.locator('.day-plus')).toHaveText('+20');
  await expect(head).toContainText('−50');
  const cards = page.locator('main .card');
  await expect(cards.first()).toHaveClass(/best/);
  await expect(cards.first()).toContainText('🏆');
  await expect(cards.first()).toContainText('Tidy room');
  await expect(page.locator('.card.best')).toHaveCount(1);
});
