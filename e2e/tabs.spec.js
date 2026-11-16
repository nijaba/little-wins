const {
  test,
  expect,
  expectDialog,
  startFamily,
  header,
  tabButton,
  goTab,
  fold,
  openFold,
  nextPoll,
} = require('./fixtures');

const TABS = [
  ['☀️', 'Today'],
  ['⭐', 'Week'],
  ['🏆', 'Rewards'],
  ['🕘', 'History'],
  ['⚙️', 'Settings'],
];

test('E2E-30 the bottom tabs have an icon and a label, the selected one is marked', async ({
  page,
}) => {
  await startFamily(page);
  const buttons = page.locator('.tabs button');
  await expect(buttons).toHaveCount(5);
  for (const [i, [icon, label]] of TABS.entries()) {
    const b = buttons.nth(i);
    await expect(b.locator('i')).toHaveText(icon);
    await expect(b).toHaveText(`${icon}${label}`);
    await goTab(page, label);
    await expect(page.locator('.tabs .on')).toHaveCount(1);
    await expect(b).toHaveClass(/\bon\b/);
    await expect(b).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.tabs [aria-current]')).toHaveCount(1);
  }
});

test('E2E-31 the Settings sections start folded, with counts', async ({ page }) => {
  await startFamily(page, { family: 'Fold Family' });
  await goTab(page, 'Settings');
  const folds = page.locator('details.fold');
  await expect(folds).toHaveCount(8);
  for (let i = 0; i < 8; i++) await expect(folds.nth(i)).not.toHaveAttribute('open', '');
  const counts = {
    fam: 'Fold Family',
    kids: '1',
    par: '1',
    target: '9',
    penalty: '3',
    challenge: '4',
    rew: '6',
    dev: '1',
  };
  for (const [key, n] of Object.entries(counts)) {
    await expect(fold(page, key).locator('.cnt')).toHaveText(n);
  }
});

test('E2E-32 an open Settings section stays open across a poll, an edit and a cancel', async ({
  page,
}) => {
  await startFamily(page);
  await goTab(page, 'Settings');
  const rew = await openFold(page, 'rew');
  // A poll comes (a 304 when nothing changed) and the section is still open.
  await nextPoll(page);
  await expect(rew).toHaveAttribute('open', '');
  await expect(fold(page, 'target')).not.toHaveAttribute('open', '');
  // Edit then cancel.
  await rew.getByRole('button', { name: 'Edit' }).first().click();
  await expect(page.getByRole('heading', { name: 'Edit reward' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(fold(page, 'rew')).toHaveAttribute('open', '');
  // Open another one, and change tabs and come back: both are remembered.
  await openFold(page, 'dev');
  await goTab(page, 'Today');
  await goTab(page, 'Settings');
  await expect(fold(page, 'rew')).toHaveAttribute('open', '');
  await expect(fold(page, 'dev')).toHaveAttribute('open', '');
  await expect(fold(page, 'par')).not.toHaveAttribute('open', '');
  await expect(header(page)).toBeVisible();
});

test('E2E-33 saving an edit keeps its section open', async ({ page }) => {
  await startFamily(page);
  await goTab(page, 'Settings');
  const kids = await openFold(page, 'kids');
  await kids.getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Renamed');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(fold(page, 'kids')).toHaveAttribute('open', '');
  await expect(fold(page, 'kids')).toContainText('Renamed');
});

test('E2E-34 removing a behavior asks first and updates the count', async ({ page }) => {
  await startFamily(page);
  await goTab(page, 'Settings');
  const beh = await openFold(page, 'target');
  const no = expectDialog(page, false);
  await beh.getByRole('button', { name: '✕' }).first().click();
  expect((await no).message).toBe('Remove this? Past history is kept.');
  await expect(beh.locator('.cnt')).toHaveText('9');
  const yes = expectDialog(page, true);
  await beh.getByRole('button', { name: '✕' }).first().click();
  await yes;
  await expect(fold(page, 'target').locator('.cnt')).toHaveText('8');
  await expect(tabButton(page, 'Settings')).toBeVisible();
});
