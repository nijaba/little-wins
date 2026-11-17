// Lists for some children: the edit form's "Who is it for?" and what each child's Today shows.
const { test, expect, startFamily, addChild, openFold, goTab, card } = require('./fixtures');

test("E2E-140 a behavior for one child shows on that child's Today only, labelled in Settings", async ({
  page,
}) => {
  await startFamily(page, { child: 'Robin' });
  await addChild(page, 'Sky');
  const behaviors = await openFold(page, 'target');
  await behaviors.getByRole('button', { name: '+ Add' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Piano practice');
  await expect(page.getByRole('group', { name: 'Who is it for?' })).toBeVisible();
  await page.getByLabel('Sky', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(card(page, 'Piano practice')).toContainText('For: Robin');

  await goTab(page, 'Today');
  await page.locator('.chips').getByRole('button', { name: 'Robin' }).click();
  await expect(card(page, 'Piano practice')).toHaveCount(1);
  await page.locator('.chips').getByRole('button', { name: 'Sky' }).click();
  await expect(page.locator('.chip.on')).toHaveText('Sky');
  await expect(card(page, 'Piano practice')).toHaveCount(0);
  await expect(card(page, 'Tidy room')).toHaveCount(1, { timeout: 2000 });
});

test('E2E-141 with one child the edit form has no "Who is it for?" choice', async ({ page }) => {
  await startFamily(page);
  await goTab(page, 'Settings');
  const behaviors = await openFold(page, 'target');
  await behaviors.getByRole('button', { name: '+ Add' }).click();
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Who is it for?' })).toHaveCount(0);
});
