#!/usr/bin/env node
/**
 * Takes the pictures for the guides (docs/images/) from a demo family, at phone size.
 *
 * Runs the app on a free port with a temporary database, demo families on and the fake sign-in
 * (localhost only), and drives it with Playwright's Chromium. Everything on screen is the demo's
 * made-up family. Run it again when a screen changes:
 *
 *     npx playwright install chromium   # once
 *     node scripts/guide-pictures.js
 */
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'images');
const PHONE = { width: 390, height: 844 };

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** Starts the app with demo families on; resolves to { base, stop } once it is up. */
async function startServer(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'little-wins-pictures-'));
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      APP_BASE_URL: base,
      DATABASE_PATH: path.join(dir, 'pictures.db'),
      SESSION_SECRET: crypto.randomBytes(32).toString('hex'),
      LITTLE_WINS_FAKE_SSO: '1',
      DEMO_FAMILIES: '1',
      TZ: 'UTC',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => {
      out += d;
      if (/(^|\n)up\n/.test(out)) resolve();
    });
    child.stderr.on('data', (d) => {
      out += d;
    });
    child.on('exit', (code) => reject(new Error(`server exited (${code}): ${out}`)));
  });
  const stop = () => {
    child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return { base, stop };
}

/** A phone-sized page in English, in the demo's time zone, with no tour offer answered yet. */
async function phonePage(browser, base, extra = {}) {
  const context = await browser.newContext({
    baseURL: base,
    viewport: PHONE,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    reducedMotion: 'reduce',
    ...extra,
  });
  return { context, page: await context.newPage() };
}

/** Opens a new demo family from the sign-in page. */
async function openDemo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a demo' }).click();
  await page.getByRole('region', { name: 'Demo' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

const tab = (page, name) => page.locator(`.tabs [data-tab=${name}]`).click();

async function main() {
  const { chromium } = require('@playwright/test');
  const server = await startServer();
  const browser = await chromium.launch();
  const shots = [];
  const shoot = async (page, name, opts = {}) => {
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });
    shots.push(name);
  };
  try {
    fs.mkdirSync(OUT, { recursive: true });
    const { context, page } = await phonePage(browser, server.base);
    await page.goto('/');
    await page.getByRole('button', { name: 'Try a demo' }).waitFor();
    await shoot(page, 'sign-in');

    await openDemo(page);
    await shoot(page, 'parent-today');
    await tab(page, 'week');
    await shoot(page, 'parent-week');
    await tab(page, 'rew');
    await shoot(page, 'parent-rewards');
    await tab(page, 'hist');
    await shoot(page, 'parent-history');
    await tab(page, 'set');
    await page.locator('details[data-key=dev] summary').click();
    await shoot(page, 'parent-settings');

    // The tour, on its weekly challenges step.
    await page
      .getByRole('region', { name: 'Demo' })
      .getByRole('button', { name: 'Take the tour' })
      .click();
    for (let i = 0; i < 3; i++) await page.locator('.tour-caption [data-action=tour-next]').click();
    await page.locator('.tour-caption h3', { hasText: 'Weekly challenges' }).waitFor();
    await page.waitForTimeout(400);
    await shoot(page, 'tour');
    await page.keyboard.press('Escape');

    // What Mia sees on her own phone.
    await tab(page, 'today');
    await page.getByRole('button', { name: "Mia's view" }).click();
    await page.locator('.who').waitFor();
    await shoot(page, 'child-today');
    await tab(page, 'rew');
    await shoot(page, 'child-rewards');
    await context.close();
  } finally {
    await browser.close();
    server.stop();
  }
  console.log(`wrote ${shots.map((s) => `docs/images/${s}.png`).join(', ')}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ROOT, PHONE, startServer, phonePage, openDemo, tab };
