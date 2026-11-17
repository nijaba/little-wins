// Saving after a network failure: the page sends the write again once, with the same request
// ID, so it is saved once and no error shows (Safari on iPhones can drop a POST on a connection
// the server closed while an edit form was open).
const { test, expect, startFamily, goTab, openFold } = require('./fixtures');

// With the reminder's service worker running, WebKit sends the page's requests past
// page.route; without it they all pass through the route.
test.use({ serviceWorkers: 'block' });

test('E2E-230 a save whose first send fails is retried once: saved once, no error', async ({
  page,
}) => {
  await startFamily(page);
  await goTab(page, 'Settings');
  const good = await openFold(page, 'target');
  await good.getByRole('button', { name: 'Edit' }).first().click();
  await expect(page.getByRole('heading', { name: 'Edit behavior' })).toBeVisible();
  await page.locator('#f_name').fill('Kind words, renamed');

  // The first send fails as a dropped connection does; the next goes through.
  const ids = [];
  let failed = false;
  await page.route('**/api/item/save*', async (route) => {
    ids.push(route.request().headers()['x-request-id']);
    if (!failed) {
      failed = true;
      return route.abort('connectionreset');
    }
    return route.continue();
  });
  const dialogs = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    d.dismiss();
  });

  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Edit behavior' })).toHaveCount(0);
  await expect(fold(page)).toContainText('Kind words, renamed');
  expect(dialogs).toEqual([]);
  expect(ids).toHaveLength(2);
  expect(ids[0]).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  expect(ids[1]).toBe(ids[0]);
});

const fold = (page) => page.locator('main');
