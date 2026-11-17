// Emoji: picked in the edit form, shown on Today and on the child chips.
const { test, expect, startFamily, addChild, openFold, goTab, card } = require('./fixtures');

test('E2E-170 a parent picks an emoji for a behavior and a child, and Today shows them', async ({
  page,
}) => {
  await startFamily(page, { child: 'Robin' });
  await expect(card(page, 'Tidy room').locator('.emo')).toHaveText('🧹');
  await addChild(page, 'Sky');
  const behaviors = await openFold(page, 'target');
  await behaviors.getByRole('button', { name: '+ Add' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Feed the cat');
  await page.getByRole('button', { name: '🐶', exact: true }).click();
  await expect(page.getByLabel('Emoji', { exact: true })).toHaveValue('🐶');
  await page.getByRole('button', { name: 'Save' }).click();
  const kids = await openFold(page, 'kids');
  await kids.locator('.card', { hasText: 'Robin' }).getByRole('button', { name: 'Rename' }).click();
  await page.getByRole('button', { name: '🦊', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await goTab(page, 'Today');
  await expect(card(page, 'Feed the cat').locator('.emo')).toHaveText('🐶');
  await expect(page.locator('.chips .chip', { hasText: 'Robin' })).toContainText('🦊');
});
