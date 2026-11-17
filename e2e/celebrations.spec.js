// Celebrations: confetti for a reward, the child's points counting up, the ring glowing near the
// end, and "+5" floating up from the + button. Nothing moves with reduced motion.
const { test, expect, startFamily, card } = require('./fixtures');

const plus = (page, name) => card(page, name).getByRole('button', { name: '+', exact: true });
// A reward the next 10 points unlock, created from the page (same origin, as the app does).
const quickReward = (page) =>
  page.evaluate(() =>
    fetch('/api/reward/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ice cream', stars: 0, points: 10, emoji: '🍦' }),
    }),
  );

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('E2E-180 a reward unlocking brings confetti, and + makes "+10" float up', async ({
    page,
  }) => {
    await startFamily(page);
    await quickReward(page);
    await page.reload();
    await plus(page, 'Tidy room').click();
    await expect(page.locator('.plus-float')).toHaveText('+10');
    const party = page.locator('#party');
    await expect(party).toContainText('Reward unlocked!');
    await expect(party).toContainText('Ice cream');
    await expect(party.locator('.confetti')).toHaveCount(28);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('E2E-181 with reduced motion the reward still shows, with no confetti or floating points', async ({
    page,
  }) => {
    await startFamily(page);
    await quickReward(page);
    await page.reload();
    await plus(page, 'Tidy room').click();
    await expect(page.locator('#party')).toContainText('Ice cream');
    await expect(page.locator('#party .confetti')).toHaveCount(0);
    await expect(page.locator('.plus-float')).toHaveCount(0);
  });
});

test.describe('in a demo family', () => {
  test.use({ reducedMotion: 'no-preference', serverOptions: { env: { DEMO_FAMILIES: '1' } } });

  test("E2E-182 new points count up on the child's view, and the almost-full ring glows", async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Try a demo' }).click();
    const banner = page.getByRole('region', { name: 'Demo' });
    await banner.getByRole('button', { name: "Mia's view" }).click();
    await expect(page.locator('.who')).toBeVisible();
    await expect(page.locator('.ringcard.near')).toHaveCount(1); // 92%
    const before = await page.locator('#hdr').textContent();
    await banner.getByRole('button', { name: "Parent's view" }).click();
    await plus(page, 'Tidy room').click();
    await banner.getByRole('button', { name: "Mia's view" }).click();
    await expect(page.locator('#hdr.counting')).toHaveCount(1);
    await expect(page.locator('#hdr')).not.toHaveClass(/counting/);
    const after = await page.locator('#hdr').textContent();
    expect(Number.parseInt(after, 10) - Number.parseInt(before, 10)).toBe(10);
  });
});
