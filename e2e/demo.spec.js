// Demo families, the guided tour and the tour video (docs/design.md: "Demo families", "Tour",
// "Guide pictures and the tour video").
const fs = require('node:fs');
const path = require('node:path');
const {
  test,
  expect,
  startFamily,
  goTab,
  tabButton,
  header,
  checkFits,
  eachSize,
} = require('./fixtures');

const hasVideo = fs.existsSync(path.join(__dirname, '..', 'public', 'tour.mp4'));
const banner = (page) => page.getByRole('region', { name: 'Demo' });
const caption = (page) => page.locator('.tour-caption');

async function tryDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo' }).click();
  await expect(banner(page)).toBeVisible();
}

test.describe('demo families', () => {
  test.use({ serverOptions: { env: { DEMO_FAMILIES: '1' } } });

  test('E2E-90 Try a demo opens a made-up family with a banner on every screen, and fits phones', async ({
    page,
  }) => {
    await tryDemo(page);
    await expect(banner(page)).toContainText('made-up people and data');
    await expect(banner(page)).toContainText('30 minutes');
    await expect(page.locator('.chip')).toHaveText(['🦊Mia', '🐻Leo']);
    await expect(header(page)).not.toHaveText(/^0 pts/);
    // No once-only offer in a demo: the banner offers the tour instead.
    await expect(page.getByRole('region', { name: 'Tour offer' })).toHaveCount(0);
    for (const tab of ['Week', 'Rewards', 'History', 'Settings', 'Today']) {
      await goTab(page, tab);
      await expect(banner(page)).toBeVisible();
      await eachSize(page, `demo ${tab}`, (l) => checkFits(page, l));
    }
  });

  test("E2E-91 the child's view shows what that child would see, and the parent's view returns", async ({
    page,
  }) => {
    await tryDemo(page);
    await page.locator('.chip', { hasText: 'Leo' }).click();
    await banner(page).getByRole('button', { name: "Leo's view" }).click();
    await expect(page.locator('.who')).toHaveText('🐻Leo');
    await expect(tabButton(page, '⚙️Settings')).toHaveCount(0);
    await expect(page.locator('.tabs button')).toHaveCount(4);
    await expect(page.locator('.ringcard')).toBeVisible();
    await expect(page.getByText('Penalties')).toHaveCount(0);
    await expect(page.locator('main button')).toHaveCount(0);
    await banner(page).getByRole('button', { name: "Parent's view" }).click();
    await expect(page.locator('.who')).toHaveCount(0);
    await expect(page.locator('.chip')).toHaveText(['🦊Mia', '🐻Leo']);
  });

  test('E2E-92 Settings in a demo: invites and devices off, no export or delete, Leave the demo', async ({
    page,
  }) => {
    await tryDemo(page);
    await goTab(page, 'Settings');
    await expect(page.locator('main .note')).toContainText('This is a demo');
    await page.locator('details[data-key=par] summary').click();
    await expect(page.getByRole('button', { name: 'Invite a parent' })).toBeDisabled();
    await page.locator('details[data-key=dev] summary').click();
    await expect(page.getByRole('button', { name: /Add a device for Mia/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0);
    await page.locator('details[data-key=fam] summary').click();
    await expect(page.getByText('Download all our data')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
    await page.locator('main').getByRole('button', { name: 'Leave the demo' }).click();
    await expect(page.getByRole('button', { name: 'Try a demo' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Try a demo' })).toBeVisible();
  });

  test('E2E-96 the child tour from the demo banner walks its five steps', async ({ page }) => {
    await tryDemo(page);
    await banner(page).getByRole('button', { name: "Mia's view" }).click();
    await banner(page).getByRole('button', { name: 'Take the tour' }).click();
    const titles = [];
    for (let i = 0; i < 5; i++) {
      await expect(caption(page)).toContainText(`Step ${i + 1} of 5`);
      titles.push(await caption(page).locator('h3').textContent());
      await expect(page.locator('.tour-ring')).toBeVisible();
      await caption(page)
        .getByRole('button', { name: i === 4 ? 'Done' : 'Next' })
        .click();
    }
    expect(titles).toEqual([
      'Your points and stars',
      'Your next reward',
      'Ways to earn',
      'This week',
      'Rewards',
    ]);
    await expect(caption(page)).toHaveCount(0);
  });
});

test.describe('a full demo', () => {
  test.use({ serverOptions: { env: { DEMO_FAMILIES: '1', DEMO_MAX: '1' } } });

  test('E2E-93 when every demo family is busy, a calm note says to come back', async ({
    page,
    newPlayer,
  }) => {
    await tryDemo(page);
    const other = await newPlayer();
    await other.goto('/');
    await other.getByRole('button', { name: 'Try a demo' }).click();
    await expect(other.locator('.note')).toContainText('Every demo family is busy');
    await expect(other.getByRole('button', { name: 'Try a demo' })).toBeVisible();
  });
});

test('E2E-94 the tour is offered once per device; No thanks sticks, and Settings offers it again', async ({
  page,
}) => {
  await startFamily(page);
  const offer = page.getByRole('region', { name: 'Tour offer' });
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'No thanks' }).click();
  await expect(offer).toHaveCount(0);
  await page.reload();
  await expect(header(page)).toBeVisible();
  await expect(offer).toHaveCount(0);
  await goTab(page, 'Settings');
  await page.locator('main').getByRole('button', { name: 'Take the tour' }).click();
  await expect(caption(page)).toContainText('Step 1 of 8');
});

test('E2E-95 the parent tour switches tabs, outlines each part, goes back, and Escape closes it', async ({
  page,
}) => {
  await startFamily(page);
  const start = page.getByRole('region', { name: 'Tour offer' }).getByRole('button', {
    name: 'Take the tour',
  });
  await start.click();
  await expect(page.getByRole('region', { name: 'Tour offer' })).toHaveCount(0);
  const steps = [
    ['Earning points', 'Today'],
    ['Warnings', 'Today'],
    ['Penalties', 'Today'],
    ['Weekly challenges', 'Week'],
    ['Rewards', 'Rewards'],
    ['History and undo', 'History'],
    ['Settings', 'Settings'],
  ];
  for (const [i, [title, tab]] of steps.entries()) {
    await expect(caption(page).locator('h3')).toHaveText(title);
    await expect(caption(page)).toContainText(`Step ${i + 1} of 8`);
    await expect(page.locator('.tabs button.on')).toContainText(tab);
    await caption(page).getByRole('button', { name: 'Next' }).click();
  }
  // An empty History has nothing to outline: its caption stands alone. The last step outlines
  // the device button inside the opened Devices section.
  await expect(caption(page).locator('h3')).toHaveText("Your child's phone");
  await expect(page.locator('details[data-key=dev]')).toHaveAttribute('open', '');
  await expect(page.locator('.tour-ring')).toBeVisible();
  await caption(page).getByRole('button', { name: 'Back' }).click();
  await expect(caption(page).locator('h3')).toHaveText('Settings');
  await page.keyboard.press('Escape');
  await expect(caption(page)).toHaveCount(0);
});

test.describe('the tour video', () => {
  test.skip(!hasVideo, 'public/tour.mp4 is not made yet');

  test('E2E-97 Watch the video plays over the sign-in page and Escape closes it', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Watch the video' }).click();
    const player = page.getByRole('dialog', { name: 'Tour video' });
    await expect(player).toBeVisible();
    await expect(player.locator('video')).toHaveAttribute('src', '/tour.mp4');
    await page.keyboard.press('Escape');
    await expect(player).toHaveCount(0);
    await page.getByRole('button', { name: 'Watch the video' }).click();
    await player.getByRole('button', { name: 'Close' }).click();
    await expect(player).toHaveCount(0);
  });
});

test.describe('the tour video turned off', () => {
  test.use({ serverOptions: { env: { TOUR_VIDEO: '0' } } });

  test('E2E-98 TOUR_VIDEO=0 hides Watch the video', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Watch the video' })).toHaveCount(0);
  });
});
