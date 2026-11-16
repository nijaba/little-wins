const {
  test,
  expect,
  signInAs,
  startFamily,
  header,
  card,
  goTab,
  addChild,
  nextPoll,
} = require('./fixtures');

const chip = (page, name) => page.locator('.chips .chip', { hasText: name });
const plus = (page, name) => card(page, name).getByRole('button', { name: '+', exact: true });

test('E2E-50 with several children the parent switches between them', async ({ page }) => {
  await startFamily(page, { child: 'Kid' });
  await expect(page.locator('.chips')).toHaveCount(0);
  await addChild(page, 'Mia');
  await expect(page.locator('.chips .chip')).toHaveCount(2);
  await expect(page.locator('.chips .chip.on')).toHaveCount(1);

  await goTab(page, 'Today');
  await chip(page, 'Kid').click();
  await expect(chip(page, 'Kid')).toHaveClass(/\bon\b/);
  await plus(page, 'Tidy room').click();
  await expect(header(page)).toHaveText('10 pts · 0 ★');

  await chip(page, 'Mia').click();
  await expect(chip(page, 'Mia')).toHaveClass(/\bon\b/);
  await expect(header(page)).toHaveText('0 pts · 0 ★');
  await goTab(page, 'History');
  await expect(page.locator('main .card')).toHaveCount(0);
  await goTab(page, 'Today');
  await plus(page, 'Reading 20 min').click();
  await expect(header(page)).toHaveText('5 pts · 0 ★');

  await chip(page, 'Kid').click();
  await expect(header(page)).toHaveText('10 pts · 0 ★');
  await goTab(page, 'History');
  await expect(page.locator('main')).toContainText('Tidy room');
  await expect(page.locator('main')).not.toContainText('Reading 20 min');
});

test('E2E-51 the chosen child stays chosen across background polls', async ({ page }) => {
  await startFamily(page, { child: 'Kid' });
  await addChild(page, 'Mia');
  await goTab(page, 'Today');
  await chip(page, 'Mia').click();
  await plus(page, 'Tidy room').click();
  await expect(header(page)).toHaveText('10 pts · 0 ★');
  expect([200, 304]).toContain(await nextPoll(page));
  await expect(chip(page, 'Mia')).toHaveClass(/\bon\b/);
  await expect(header(page)).toHaveText('10 pts · 0 ★');
  await nextPoll(page);
  await expect(chip(page, 'Mia')).toHaveClass(/\bon\b/);
});

test('E2E-53 the chosen child is remembered after a reload', async ({ page }) => {
  await startFamily(page, { child: 'Kid' });
  await addChild(page, 'Mia');
  await goTab(page, 'Today');
  await chip(page, 'Mia').click();
  await plus(page, 'Tidy room').click();
  await expect(header(page)).toHaveText('10 pts · 0 ★');
  await page.reload();
  await expect(chip(page, 'Mia')).toHaveClass(/\bon\b/);
  await expect(header(page)).toHaveText('10 pts · 0 ★');
});

test('E2E-52 a change made on another device shows up on the chosen child, not the first', async ({
  page,
  newPlayer,
}) => {
  await startFamily(page, { child: 'Kid' });
  await addChild(page, 'Mia');
  await goTab(page, 'Today');
  await chip(page, 'Mia').click();
  await expect(chip(page, 'Mia')).toHaveClass(/\bon\b/);

  // The same parent on a second device records points for Mia.
  const other = await newPlayer();
  await signInAs(other, 'Alice');
  await chip(other, 'Mia').click();
  await plus(other, 'Tidy room').click();
  await expect(header(other)).toHaveText('10 pts · 0 ★');

  // The first device picks it up with a poll that returns new state, and stays on Mia.
  await expect(header(page)).toHaveText('10 pts · 0 ★', { timeout: 15_000 });
  await expect(chip(page, 'Mia')).toHaveClass(/\bon\b/);
  await chip(page, 'Kid').click();
  await expect(header(page)).toHaveText('0 pts · 0 ★');
});
