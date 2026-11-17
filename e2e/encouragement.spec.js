// Encouragement: a parent's message and the milestones at the top of Today.
const { test, expect, startFamily, expectDialog } = require('./fixtures');

test('E2E-130 a parent writes a message for the child, sees it on Today, and clears it', async ({
  page,
}) => {
  await startFamily(page, { child: 'Robin' });
  const asked = expectDialog(page, 'Proud of you, Robin!');
  await page.getByRole('button', { name: '💬 Write Robin a message' }).click();
  const d = await asked;
  expect(d.type).toBe('prompt');
  const card = page.locator('.card.msg');
  await expect(card).toContainText('💬 Proud of you, Robin!');
  await expect(card).toContainText('from Alice Example');
  await card.getByRole('button', { name: 'Clear' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('button', { name: '💬 Write Robin a message' })).toBeVisible();
});

test.describe('in a demo family', () => {
  test.use({ serverOptions: { env: { DEMO_FAMILIES: '1' } } });

  test("E2E-131 the child's view shows the parent's message, with no buttons", async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Try a demo' }).click();
    await page.getByRole('button', { name: "Mia's view" }).click();
    await expect(page.locator('.who')).toBeVisible();
    const card = page.locator('.card.msg');
    await expect(card).toContainText('💬 Great job helping with dinner yesterday.');
    await expect(card).toContainText('from Sam (demo)');
    await expect(card.getByRole('button')).toHaveCount(0);
  });
});
