// Light and dark: the page follows the device's color scheme.
const { test, expect, startFamily } = require('./fixtures');

const colors = (page) =>
  page.evaluate(() => {
    const css = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
    return {
      body: css('body', 'backgroundColor'),
      text: css('body', 'color'),
      card: css('.card', 'backgroundColor'),
      tabs: css('.tabs', 'backgroundColor'),
    };
  });

test.describe('dark', () => {
  test.use({ colorScheme: 'dark' });

  test('E2E-110 with a dark device setting the page is dark, with light text', async ({ page }) => {
    await startFamily(page);
    const c = await colors(page);
    expect(c.body).toBe('rgb(16, 20, 24)');
    expect(c.text).toBe('rgb(230, 235, 240)');
    expect(c.card).toBe('rgb(27, 34, 41)');
    expect(c.tabs).toBe('rgb(27, 34, 41)');
  });
});

test.describe('light', () => {
  test.use({ colorScheme: 'light' });

  test('E2E-111 with a light device setting the page stays light', async ({ page }) => {
    await startFamily(page);
    const c = await colors(page);
    expect(c.body).toBe('rgb(246, 248, 249)');
    expect(c.card).toBe('rgb(255, 255, 255)');
  });
});
