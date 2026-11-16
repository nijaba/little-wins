const {
  test,
  expect,
  expectDialog,
  startFamily,
  header,
  goTab,
  fold,
  openFold,
  card,
} = require('./fixtures');

/** Parent: Settings → Devices → Add a device for <child>. Returns the code as shown. */
async function makeCode(page, child = 'Kid') {
  await goTab(page, 'Settings');
  const dev = await openFold(page, 'dev');
  await dev.getByRole('button', { name: `Add a device for ${child}` }).click();
  const code = dev.locator('.code');
  await expect(code).toHaveText(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/);
  return (await code.textContent()).trim();
}

test('E2E-60 a child device pairs with a typed code and sees only the child view', async ({
  page,
  newPlayer,
}) => {
  await startFamily(page, { child: 'Kid' });
  // Something recorded, so the child has history, a penalty-free view and a balance to show.
  await card(page, 'Tidy room').getByRole('button', { name: '+', exact: true }).click();
  await expect(header(page)).toHaveText('10 pts · 0 ★');
  const code = await makeCode(page);
  await expect(page.locator('#cd')).toHaveText(/^Expires in \d+:\d\d$/);
  // The countdown moves.
  const first = await page.locator('#cd').textContent();
  await expect.poll(() => page.locator('#cd').textContent(), { timeout: 5000 }).not.toBe(first);

  const kid = await newPlayer();
  await kid.goto('/');
  await kid.getByLabel('Use a code from a parent').fill(code.replace(/-/g, '').toLowerCase());
  await kid.getByRole('button', { name: 'Connect this device' }).click();
  await expect(header(kid)).toHaveText('10 pts · 0 ★');
  await expect(kid.locator('header .who')).toHaveText('Kid');
  await expect(kid.locator('.tabs button')).toHaveText([
    '☀️Today',
    '⭐Week',
    '🏆Rewards',
    '🕘History',
  ]);
  await expect(kid.getByRole('button', { name: 'Settings' })).toHaveCount(0);

  // Today: ways to earn, no buttons and no penalties.
  await expect(kid.getByRole('heading', { name: 'Ways to earn points' })).toBeVisible();
  await expect(kid.getByText('Tidy room')).toBeVisible();
  await expect(kid.locator('main button')).toHaveCount(0);
  await expect(kid.getByText('Penalties')).toHaveCount(0);
  await expect(kid.getByText('Hitting or hurting someone')).toHaveCount(0);
  await expect(kid.getByText('Next reward')).toBeVisible();
  // Week: nothing to tap.
  await goTab(kid, 'Week');
  await expect(kid.locator('button.d')).toHaveCount(0);
  await goTab(kid, 'Rewards');
  await expect(kid.getByText('Pick the family movie').first()).toBeVisible();
  // History: no undo buttons.
  await goTab(kid, 'History');
  await expect(kid.locator('main')).toContainText('Tidy room');
  await expect(kid.locator('main button')).toHaveCount(0);

  // The parent sees the new device (the open section is refreshed by the poll).
  await expect(fold(page, 'dev').locator('.cnt')).toHaveText('2', { timeout: 15_000 });
  await expect(fold(page, 'dev')).toHaveAttribute('open', '');
  const row = card(page, /Child · Last used/);
  await expect(row).toHaveCount(1);

  // Logging it out: the child lands on the sign-in screen on its next refresh.
  const confirmed = expectDialog(page, true);
  await row.getByRole('button', { name: 'Log out' }).click();
  expect((await confirmed).message).toContain('Log out that device?');
  await expect(fold(page, 'dev').locator('.cnt')).toHaveText('1');
  await kid.reload();
  await expect(kid.getByRole('heading', { name: 'Use a code from a parent' })).toBeVisible();
  await expect(kid.locator('.tabs')).toHaveCount(0);
});

test('E2E-61 a child device pairs by opening the link', async ({ page, newPlayer }) => {
  await startFamily(page, { child: 'Kid' });
  await makeCode(page);
  const link = await fold(page, 'dev').locator('input.link').inputValue();
  expect(link).toMatch(/\/#pair=[A-Za-z0-9]+$/);
  const kid = await newPlayer();
  await kid.goto(link);
  await expect(kid.locator('header .who')).toHaveText('Kid');
  expect(kid.url()).not.toContain('pair=');
  // A code works once.
  const again = await newPlayer();
  await again.goto(link);
  // A used link shows the sign-in screen with the message under the code box (no alert).
  await expect(again.getByRole('heading', { name: 'Use a code from a parent' })).toBeVisible();
  await expect(again.locator('#err')).toContainText("That code doesn't work");
});

test('E2E-62 a wrong code shows a message on the sign-in screen', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Use a code from a parent').fill('abcdefghjk');
  await page.getByRole('button', { name: 'Connect this device' }).click();
  await expect(page.locator('#err')).toHaveText(/Ask a parent for a new one/);
});

test.describe('invite', () => {
  test.use({ serverOptions: { allowlist: 'google:alice@example.com', signup: 'closed' } });

  test('E2E-63 a parent joins through an invite link', async ({ page, newPlayer }) => {
    await startFamily(page, { family: 'Joinable Family' });
    await goTab(page, 'Settings');
    const par = await openFold(page, 'par');
    await par.getByRole('button', { name: 'Invite a parent' }).click();
    const link = await par.locator('input.link').inputValue();
    expect(link).toMatch(/\/#invite=[\w-]+$/);

    const bob = await newPlayer();
    await bob.goto(link);
    await expect(bob.getByRole('heading', { name: 'Join Joinable Family' })).toBeVisible();
    await bob.getByRole('link', { name: 'Sign in with Google' }).click();
    await bob.getByRole('link', { name: /^Bob Example/ }).click();
    await expect(header(bob)).toHaveText('0 pts · 0 ★');
    await goTab(bob, 'Settings');
    const bobParents = await openFold(bob, 'par');
    await expect(bobParents).toContainText('Alice Example');
    await expect(bobParents).toContainText('Bob Example');
    await expect(bobParents.locator('.cnt')).toHaveText('2');
    // Bob is a regular parent: no delete tools.
    await openFold(bob, 'fam');
    await expect(bob.getByRole('button', { name: 'Delete this family' })).toHaveCount(0);

    // The invite works once.
    const carol = await newPlayer();
    await carol.goto(link);
    await expect(carol.getByText("This invite link doesn't work.")).toBeVisible();
  });

  test('E2E-64 "Not now" on an invite screen goes back to the sign-in screen', async ({
    page,
    newPlayer,
  }) => {
    await startFamily(page);
    await goTab(page, 'Settings');
    const par = await openFold(page, 'par');
    await par.getByRole('button', { name: 'Invite a parent' }).click();
    const link = await par.locator('input.link').inputValue();
    const other = await newPlayer();
    await other.goto(link);
    await other.getByRole('button', { name: 'Not now' }).click();
    await expect(other.getByRole('heading', { name: 'For parents' })).toBeVisible();
    expect(other.url()).not.toContain('invite=');
  });
});
