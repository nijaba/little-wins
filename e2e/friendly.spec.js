// The child's greeting and today line, reward cards as goals, and kind words for empty lists.
const { test, expect, signInAs, createFamily, goTab, card } = require('./fixtures');

test.describe('in a demo family', () => {
  test.use({ serverOptions: { env: { DEMO_FAMILIES: '1' } } });

  test("E2E-200 the child's Today greets them by time of day and counts today's points", async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Try a demo' }).click();
    const banner = page.getByRole('region', { name: 'Demo' });
    await banner.getByRole('button', { name: "Mia's view" }).click();
    await expect(page.locator('.greet')).toHaveText(/^Good (morning|afternoon|evening), 🦊Mia! /);
    // The demo's history may already have points earlier today; read where it starts.
    const first = await page.locator('.today-line').textContent();
    const before = first.startsWith('+') ? Number.parseInt(first.slice(1), 10) : 0;
    if (!before) expect(first).toBe('No points yet today, let’s go!');
    await banner.getByRole('button', { name: "Parent's view" }).click();
    await expect(page.locator('.greet')).toHaveCount(0);
    await card(page, 'Tidy room').getByRole('button', { name: '+', exact: true }).click();
    await banner.getByRole('button', { name: "Mia's view" }).click();
    await expect(page.locator('.today-line')).toHaveText(`+${before + 10} today, great going!`);
  });

  test('E2E-201 locked rewards say what is left; unlocked ones sparkle', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Try a demo' }).click();
    await goTab(page, 'Rewards');
    await expect(card(page, 'New book').locator('.goal')).toHaveText('1 more ★ to go!');
    await expect(card(page, 'A special day out').locator('.goal')).toHaveText('7 more ★ to go!');
    await expect(page.locator('.won-card')).toHaveCount(4);
    await expect(page.locator('.won-card .goal')).toHaveCount(0);
  });
});

test('E2E-202 empty lists say something kind instead of nothing', async ({ page }) => {
  await signInAs(page, 'Alice');
  await createFamily(page, { starter: false });
  await goTab(page, 'History');
  await expect(page.locator('.empty')).toHaveText('Nothing here yet. The first win is on its way!');
  await goTab(page, 'Rewards');
  await expect(page.locator('.empty')).toHaveText(
    'No rewards yet. Add the first one in Settings → Rewards.',
  );
  await goTab(page, 'Week');
  await expect(page.locator('.empty')).toHaveText(
    'No weekly challenges yet. Add one in Settings → Weekly challenges.',
  );
});
