// Fixtures and helpers for the browser tests.
//
//   app            a server of its own (temp database, fake sign-in) for each test
//   context/page   watched: a CSP violation, an uncaught page error or an unexpected dialog
//                  fails the test
//   newPlayer()    another browser context (a second device) with the same watching
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const base = require('@playwright/test');

const { expect } = base;
const ROOT = path.join(__dirname, '..');
// Generated per run, so no secret-looking literal sits in the repository.
const SECRET = require('node:crypto').randomBytes(32).toString('hex');

const live = new Set();
process.on('exit', () => {
  for (const c of live) c.kill('SIGKILL');
});

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** Starts server/index.js on a free port with a temporary database; resolves at "up". */
async function startApp({ allowlist = '*', signup = 'open', env: extra = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'little-wins-e2e-'));
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const env = {
    PATH: process.env.PATH,
    PORT: String(port),
    DATABASE_PATH: path.join(dir, 'test.db'),
    APP_BASE_URL: base,
    SESSION_SECRET: SECRET,
    LITTLE_WINS_FAKE_SSO: '1',
    PARENT_ALLOWLIST: allowlist,
    SIGNUP_MODE: signup,
    ...extra,
  };
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  live.add(child);
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
  const stop = async () => {
    if (child.exitCode === null && !child.signalCode) {
      await new Promise((resolve) => {
        child.once('exit', resolve);
        child.kill();
      });
    }
    live.delete(child);
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return { base, port, dir, stop };
}

/** Watches a context: collects CSP violations, page errors and unexpected dialogs. */
async function watch(context, problems) {
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSPVIOLATION ${e.violatedDirective} ${e.blockedURI} ${e.sample}`);
    });
  });
  context.on('page', (page) => {
    page.dialogQueue = [];
    page.on('console', (m) => {
      const t = m.text();
      if (t.startsWith('CSPVIOLATION')) problems.push(`CSP: ${t}`);
    });
    page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
    page.on('dialog', async (d) => {
      const next = page.dialogQueue.shift();
      if (!next) {
        problems.push(`unexpected ${d.type()} dialog: ${d.message()}`);
        await d.dismiss();
        return;
      }
      next.resolve({ type: d.type(), message: d.message(), defaultValue: d.defaultValue() });
      if (next.accept === false) await d.dismiss();
      else await d.accept(typeof next.accept === 'string' ? next.accept : undefined);
    });
  });
}

const test = base.test.extend({
  serverOptions: [{}, { option: true }],
  app: async ({ serverOptions }, use) => {
    const app = await startApp(serverOptions);
    try {
      await use(app);
    } finally {
      await app.stop();
    }
  },
  baseURL: async ({ app }, use) => use(app.base),
  // biome-ignore lint/correctness/noEmptyPattern: Playwright needs a destructured first argument
  problems: async ({}, use) => {
    const problems = [];
    await use(problems);
    expect(problems, 'CSP violations, page errors or unexpected dialogs').toEqual([]);
  },
  context: async ({ context, problems }, use) => {
    await watch(context, problems);
    await use(context);
  },
  /** newPlayer() opens another device: a new context shaped like the project's, and a page. */
  newPlayer: async ({ browser, app, problems }, use, testInfo) => {
    const opened = [];
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
    await use(async () => {
      const context = await browser.newContext({
        baseURL: app.base,
        viewport,
        userAgent,
        deviceScaleFactor,
        isMobile,
        hasTouch,
      });
      opened.push(context);
      await watch(context, problems);
      return context.newPage();
    });
    for (const c of opened) await c.close();
  },
});

/**
 * Expects the next dialog on `page` to be handled: accept (true, or the text for a prompt) or
 * dismiss (false). Resolves to { type, message } once it was. Call before the click.
 */
function expectDialog(page, accept = true) {
  return new Promise((resolve) => {
    page.dialogQueue.push({ accept, resolve });
  });
}

// --- Page helpers -------------------------------------------------------------------------------

/** Signs in through the real page and the fake provider; `who` is Alice, Bob, Carol or Dan. */
async function signInAs(page, who = 'Alice', provider = 'Google') {
  await page.goto('/');
  await page.getByRole('link', { name: `Sign in with ${provider}` }).click();
  await page.getByRole('link', { name: new RegExp(`^${who} Example`) }).click();
  await expect(page.locator('header, h2').first()).toBeVisible();
}

/** Fills the setup form and creates the family. Lands on Today. */
async function createFamily(
  page,
  { family = 'The Testers', child = 'Kid', starter = true, weekStart } = {},
) {
  await expect(page.getByRole('heading', { name: 'Set up your family' })).toBeVisible();
  await page.getByLabel('Family name').fill(family);
  await page.getByLabel("First child's name").fill(child);
  if (weekStart) await page.getByLabel(weekStart, { exact: true }).check();
  if (!starter)
    await page.getByLabel('Start with a sample list of behaviors and rewards').uncheck();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.locator('header b')).toBeVisible();
}

/** Sign in as Alice and set up a family: the usual start of a test. */
async function startFamily(page, opts) {
  await signInAs(page, 'Alice');
  await createFamily(page, opts);
}

const header = (page) => page.locator('header b');
const tabButton = (page, name) => page.locator('.tabs').getByRole('button', { name, exact: true });
const goTab = async (page, name) => {
  await tabButton(page, name).click();
  await expect(tabButton(page, name)).toHaveClass(/\bon\b/);
};
/** A Settings section by its key: fam, kids, par, target, penalty, challenge, rew, dev. */
const fold = (page, key) => page.locator(`details.fold[data-key="${key}"]`);
async function openFold(page, key) {
  const f = fold(page, key);
  if ((await f.getAttribute('open')) === null) await f.locator('summary').click();
  await expect(f).toHaveAttribute('open', '');
  return f;
}
const card = (page, text) => page.locator('main .card').filter({ hasText: text });

/** Waits for the next background poll of /api/state (a 200 or a 304) and returns its status. */
async function nextPoll(page) {
  const r = await page.waitForResponse(
    (x) => new URL(x.url()).pathname === '/api/state' && x.request().method() === 'GET',
    { timeout: 12_000 },
  );
  return r.status();
}

/** Adds a child through Settings → Children. */
async function addChild(page, name) {
  await goTab(page, 'Settings');
  const kids = await openFold(page, 'kids');
  await kids.getByRole('button', { name: '+ Add child' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
}

// --- Layout helpers (layout.spec.js, languages.spec.js) ------------------------------------------

const SIZES = [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
const FOLDS = ['fam', 'kids', 'par', 'target', 'penalty', 'challenge', 'rew', 'dev', 'rem'];

/** No sideways scroll, and (when there is a tab bar) the last item ends above it. */
async function checkFits(page, label) {
  const r = await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    const tabs = document.querySelector('.tabs');
    const last = document.querySelector('main')?.lastElementChild;
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      tabsTop: tabs ? tabs.getBoundingClientRect().top : null,
      lastBottom: last ? last.getBoundingClientRect().bottom : null,
    };
  });
  expect(r.scrollWidth, `${label}: horizontal scroll`).toBeLessThanOrEqual(r.innerWidth);
  if (r.tabsTop !== null) {
    expect(r.lastBottom, `${label}: last item under the tab bar`).toBeLessThanOrEqual(
      r.tabsTop + 0.5,
    );
  }
}

async function eachSize(page, name, fn) {
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await fn(`${name} @${size.width}x${size.height}`);
  }
}

module.exports = {
  SIZES,
  FOLDS,
  checkFits,
  eachSize,
  test,
  expect,
  expectDialog,
  signInAs,
  createFamily,
  startFamily,
  header,
  tabButton,
  goTab,
  fold,
  openFold,
  card,
  nextPoll,
  addChild,
};
