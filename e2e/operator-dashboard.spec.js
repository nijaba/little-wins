// The operator dashboard (operator.html): numbers, and a setting changed, refused and reset.
const { test, expect, signInAs } = require('./fixtures');

test.use({
  serverOptions: {
    signup: 'closed',
    allowlist: '',
    env: { OPERATOR_ALLOWLIST: 'google:bob@example.com' },
  },
});

test('E2E-250 the operator opens the dashboard from the app, changes a setting, sees a refusal, and resets it', async ({
  page,
}) => {
  await signInAs(page, 'Bob');
  await expect(page.getByRole('heading', { name: 'Operator' })).toBeVisible();
  await page.getByRole('link', { name: 'Open the dashboard' }).click();
  await expect(page).toHaveURL(/\/operator\.html$/);
  await expect(page.getByRole('heading', { name: 'This Little Wins' })).toBeVisible();
  await expect(page.locator('.stat').first()).toContainText('families');
  await expect(page.getByRole('img', { name: /New families per week/ })).toBeVisible();

  const row = page.locator('[data-setting=LIMIT_FAMILIES]');
  await expect(row.locator('.src')).toHaveText('Default (not set in .env)');
  await row.getByLabel('Most families').fill('0');
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(row.getByRole('alert')).toContainText('at least 1');
  await row.getByLabel('Most families').fill('25');
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(row.locator('.src')).toContainText('Changed here');
  await expect(row.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.stat').first()).toContainText('of 25');
  await page.reload();
  await expect(page.locator('[data-setting=LIMIT_FAMILIES] input')).toHaveValue('25');
  await page
    .locator('[data-setting=LIMIT_FAMILIES]')
    .getByRole('button', { name: 'Back to .env' })
    .click();
  await expect(page.locator('[data-setting=LIMIT_FAMILIES] .src')).toHaveText(
    'Default (not set in .env)',
  );
  await expect(page.locator('[data-setting=LIMIT_FAMILIES] input')).toHaveValue('');
});

test('E2E-251 the dashboard tells a visitor to sign in first', async ({ page }) => {
  await page.goto('/operator.html');
  await expect(page.locator('.note')).toContainText('Sign in to Little Wins first');
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/');
});
