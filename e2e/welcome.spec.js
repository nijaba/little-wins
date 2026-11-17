// The welcome at the top of the sign-in page.
const { test, expect } = require('./fixtures');

test('E2E-160 the sign-in page opens with the welcome: the star, the name, the tagline and three reasons', async ({
  page,
}) => {
  await page.goto('/');
  const hero = page.locator('.hero');
  await expect(hero.getByRole('heading', { name: 'Little Wins', level: 1 })).toBeVisible();
  await expect(hero).toContainText('Celebrate the small wins, one star at a time.');
  await expect(hero.locator('.perks li')).toHaveCount(3);
  await expect(hero.locator('img.hero-logo')).toHaveAttribute('src', 'icon.svg');
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(wide, 'no sideways scrolling').toBe(false);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('E2E-161 the welcome stays still when the device asks for reduced motion', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('.hero')).toBeVisible();
    const names = await page.evaluate(() =>
      [...document.querySelectorAll('.sparkle, .hero-logo')].map(
        (el) => getComputedStyle(el).animationName,
      ),
    );
    expect(names.length).toBe(6);
    expect(names.every((n) => n === 'none')).toBe(true);
  });
});

test('E2E-162 the footer links to the project page, before Privacy and Terms', async ({ page }) => {
  await page.goto('/');
  const about = page.locator('.legal').getByRole('link', { name: 'About Little Wins' });
  await expect(about).toHaveAttribute('href', 'https://nijaba.github.io/little-wins/');
  await expect(about).toHaveAttribute('rel', 'noopener noreferrer');
});
