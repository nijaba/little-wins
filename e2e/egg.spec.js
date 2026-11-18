// The hidden emoji picker: first star, last star, first star in the child's jar makes the emoji
// jiggle; a child picks their own, seen on their view only. See docs/design.md, "Easter egg".
const { test, expect, goTab } = require('./fixtures');

test.use({ serverOptions: { env: { DEMO_FAMILIES: '1' } } });

test("E2E-240 first, last, first star in the child's jar opens the emoji picker; the pick shows for the child only", async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo' }).click();
  const banner = page.getByRole('region', { name: 'Demo' });
  await banner.getByRole('button', { name: "Mia's view" }).click();
  await goTab(page, 'Rewards');
  const stars = page.locator('.jar [data-action=jar]');
  await expect(stars).toHaveCount(6);
  // A wrong order does nothing.
  await stars.nth(0).click();
  await stars.nth(1).click();
  await stars.nth(0).click();
  await expect(page.locator('.emo-egg')).toHaveCount(0);
  await stars.nth(0).click();
  await stars.nth(5).click();
  await stars.nth(0).click();
  await expect(page.getByText('You found the secret!')).toBeVisible();
  const card = page.locator('.card', { hasText: 'Pick the family movie' });
  // A jiggling emoji never holds still (and the toast may cover it), so the click goes to it
  // directly instead of waiting.
  await card.locator('.emo-egg').dispatchEvent('click');
  const picker = page.getByRole('dialog', { name: 'Pick your emoji' });
  await picker.getByRole('button', { name: '🧸' }).click();
  await expect(picker).toHaveCount(0);
  await expect(card.locator('.emo-egg')).toHaveText('🧸');
  await page.getByRole('button', { name: '✓ Done' }).click();
  await expect(page.locator('.emo-egg')).toHaveCount(0);
  await expect(card).toContainText('🧸Pick the family movie');
  await banner.getByRole('button', { name: 'Parent' }).click();
  await goTab(page, 'Rewards');
  await expect(page.locator('.card', { hasText: 'Pick the family movie' })).not.toContainText('🧸');
});
