const {
  test,
  expect,
  expectDialog,
  signInAs,
  createFamily,
  startFamily,
  header,
  goTab,
  openFold,
  fold,
} = require('./fixtures');

test('E2E-01 sign in and set up a family with the starter list', async ({ page }) => {
  await signInAs(page, 'Alice');
  await expect(page.getByRole('heading', { name: 'Set up your family' })).toBeVisible();
  await expect(page.getByText('Welcome, Alice Example.')).toBeVisible();
  // Every field is reachable through its label.
  await expect(page.getByLabel('Family name')).toBeVisible();
  await expect(page.getByLabel("First child's name")).toBeVisible();
  await expect(page.getByLabel('Time zone')).not.toHaveValue('');
  await expect(page.getByRole('group', { name: 'Week starts on' })).toBeVisible();
  await expect(page.getByLabel('Monday')).toBeChecked();
  await expect(page.getByLabel('Start with a sample list of behaviors and rewards')).toBeChecked();
  await createFamily(page, { family: 'The Testers', child: 'Kid' });
  await expect(header(page)).toHaveText('0 pts · 0 ★');
  await expect(page.getByRole('heading', { name: 'Earn points' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+', exact: true })).toHaveCount(9);
  await expect(page.getByRole('button', { name: '-50', exact: true })).toHaveCount(3);
  await expect(page.getByText('Tidy room')).toBeVisible();
});

test('E2E-02 set up a family without the starter list', async ({ page }) => {
  await startFamily(page, { starter: false });
  await expect(header(page)).toHaveText('0 pts · 0 ★');
  await expect(page.getByRole('button', { name: '+', exact: true })).toHaveCount(0);
  await goTab(page, 'Settings');
  for (const key of ['target', 'penalty', 'challenge', 'rew']) {
    await expect(fold(page, key).locator('.cnt')).toHaveText('0');
  }
});

test.describe('closed sign-up', () => {
  test.use({ serverOptions: { allowlist: 'google:alice@example.com', signup: 'closed' } });

  test('E2E-03 a person who is not allowed sees the private message and stays signed out', async ({
    page,
  }) => {
    await signInAs(page, 'Bob');
    await expect(page.getByText('This Little Wins is private.')).toBeVisible();
    await page.getByRole('link', { name: /back/i }).click();
    await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
    await expect(page.locator('header')).toHaveCount(0);
  });
});

test('E2E-04 delete the family from Settings', async ({ page }) => {
  await startFamily(page, { family: 'Goodbye Family' });
  await goTab(page, 'Settings');
  const fam = await openFold(page, 'fam');
  const input = fam.getByLabel('Type the family name to confirm');
  const del = fam.getByRole('button', { name: 'Delete this family' });
  await expect(del).toBeDisabled();
  await input.fill('Goodbye');
  await expect(del).toBeDisabled();
  await input.fill('Goodbye Family');
  await expect(del).toBeEnabled();
  const confirmed = expectDialog(page, true);
  await del.click();
  expect((await confirmed).message).toContain('Delete this family and everything in it?');
  await expect(page.getByText('Family deleted.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
  // The family is really gone: signing in again offers a fresh setup.
  await signInAs(page, 'Alice');
  await expect(page.getByRole('heading', { name: 'Set up your family' })).toBeVisible();
});

test('E2E-05 declining the delete confirmation keeps the family', async ({ page }) => {
  await startFamily(page, { family: 'Stay Family' });
  await goTab(page, 'Settings');
  const fam = await openFold(page, 'fam');
  await fam.getByLabel('Type the family name to confirm').fill('Stay Family');
  const declined = expectDialog(page, false);
  await fam.getByRole('button', { name: 'Delete this family' }).click();
  await declined;
  await expect(header(page)).toBeVisible();
  await expect(fold(page, 'fam').locator('.cnt')).toHaveText('Stay Family');
});
