const {
  test,
  expect,
  signInAs,
  createFamily,
  goTab,
  openFold,
  fold,
  addChild,
  SIZES,
  FOLDS,
  checkFits,
  eachSize,
} = require('./fixtures');

test('E2E-70 the sign-in and setup screens fit phone screens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in with Google' })).toBeVisible();
  await eachSize(page, 'sign-in', (l) => checkFits(page, l));
  await signInAs(page, 'Alice');
  await expect(page.getByRole('heading', { name: 'Set up your family' })).toBeVisible();
  await eachSize(page, 'setup', (l) => checkFits(page, l));
});

// One test per phone size: walking every screen and section at all four sizes in one test was too
// slow for CI's smaller runners.
for (const size of SIZES) {
  test(`E2E-71 every main screen and every Settings section fits ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const check = (name) => checkFits(page, `${name} @${size.width}x${size.height}`);
    await signInAs(page, 'Alice');
    await createFamily(page, {
      family: 'The Montgomery-Featherstonehaugh Family',
      child: 'Maximiliana Wolfeschlegelstein',
    });
    await addChild(page, 'Bartholomew Alexander');

    // Long link and code boxes are the likeliest to overflow: make both.
    const par = await openFold(page, 'par');
    await par.getByRole('button', { name: 'Invite a parent' }).click();
    await expect(par.locator('input.link')).toBeVisible();
    const dev = await openFold(page, 'dev');
    await dev
      .getByRole('button', { name: 'Add a device for Maximiliana Wolfeschlegelstein' })
      .click();
    await expect(dev.locator('.code')).toBeVisible();
    for (const key of ['par', 'dev']) await fold(page, key).locator('summary').click();

    for (const tab of ['Today', 'Week', 'Rewards', 'History']) {
      await goTab(page, tab);
      await check(tab);
    }
    await goTab(page, 'Settings');
    await check('Settings (folded)');
    for (const key of FOLDS) {
      const f = await openFold(page, key);
      await check(`Settings: ${key}`);
      await f.locator('summary').click();
      await expect(fold(page, key)).not.toHaveAttribute('open', '');
    }
    for (const key of FOLDS) await openFold(page, key);
    await check('Settings (all open)');
  });
}
