// Stars to collect, on the child's screens: gold stickers, the "won!" stamp and the star jar.
const { test, expect, goTab } = require('./fixtures');

test.use({ serverOptions: { env: { DEMO_FAMILIES: '1' } } });

test("E2E-190 the child's Week shows perfect days as stickers and won weeks stamped; Rewards has the star jar", async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo' }).click();
  const banner = page.getByRole('region', { name: 'Demo' });
  // The parent's screens keep their plain marks and no jar.
  await goTab(page, 'Week');
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(page.locator('.sticker')).toHaveCount(0);
  await goTab(page, 'Rewards');
  await expect(page.locator('.jar')).toHaveCount(0);

  await banner.getByRole('button', { name: "Mia's view" }).click();
  await expect(page.locator('.who')).toBeVisible();
  await goTab(page, 'Week');
  await page.getByRole('button', { name: 'Previous week' }).click();
  await expect(page.locator('.sticker').first()).toHaveText(/★/);
  await expect(page.locator('.stamp').first()).toHaveText('⭐ won!');
  await goTab(page, 'Rewards');
  const jar = page.locator('.jar');
  await expect(jar).toContainText('Your stars: 5');
  await expect(jar.locator('.jar-star')).toHaveCount(5);
  await expect(jar.locator('.jar-empty')).toHaveCount(1);
  await expect(jar).toContainText('1 more ★ for 📕New book');
});
