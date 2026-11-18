// The operator dashboard: counts and health, and settings that win over .env until reset.
// See docs/design.md, "The operator".
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { jar, startServer } = require('./helpers');

const OP = { sub: 'op-1', email: 'op@example.test', name: 'Olive Operator' };
let srv;
let op;

before(async () => {
  srv = await startServer({
    env: {
      OPERATOR_ALLOWLIST: 'google:op@example.test',
      SIGNUP_MODE: 'closed',
      PRIVACY_URL: 'https://example.test/privacy',
      LIMIT_CHILDREN: '5',
    },
  });
  op = jar();
  assert.ok((await srv.signIn(op, 'google', OP)).ok);
});
after(() => srv.close());

const dash = async (j = op) => srv.api(j, '/api/operator/dashboard');
const set = (key, value, j = op) => srv.api(j, '/api/operator/setting', { key, value });
const reset = (key) => srv.api(op, '/api/operator/setting', { key, reset: true });
const setting = (D, key) => D.settings.find((s) => s.key === key);

test('OD-01 the dashboard and its settings are for operators only', async () => {
  assert.equal((await dash(jar())).status, 401, 'no session');
  // An ordinary parent: open sign-up for a moment so they can have a family.
  assert.equal((await set('SIGNUP_MODE', 'open')).status, 200);
  const parent = await srv.newFamily();
  const kid = await srv.pairChild(parent.jar, parent.childId);
  for (const j of [parent.jar, kid.jar]) {
    assert.equal((await dash(j)).status, 403);
    assert.equal((await set('LIMIT_FAMILIES', '1', j)).status, 403);
  }
  assert.equal((await reset('SIGNUP_MODE')).status, 200);
  // A read only: a POST to it is refused, and so is a GET of the write.
  assert.equal((await srv.api(op, '/api/operator/dashboard', {})).status, 405);
  assert.equal((await srv.api(op, '/api/operator/setting')).status, 404);
});

test('OD-02 the numbers: counts only, never a name or an email', async () => {
  const r = await dash();
  assert.equal(r.status, 200);
  const D = r.json;
  assert.ok(D.stats.families >= 1);
  assert.equal(D.stats.weeks.length, 12);
  assert.ok(D.stats.weeks.at(-1).families >= 1, 'this week has the new family');
  assert.equal(D.stats.languages[0].language, 'en');
  for (const k of [
    'parentDevices',
    'childDevices',
    'activeDevices1d',
    'activeFamilies7d',
    'entries7d',
    'reminders',
    'childNotices',
    'openFamilyInvites',
    'idleSoon',
  ])
    assert.equal(typeof D.stats[k], 'number', k);
  assert.equal(typeof D.uptimeSeconds, 'number');
  assert.match(D.version, /^\d+\.\d+\.\d+/);
  assert.doesNotMatch(
    r.text,
    /Test Family|Kid"|example\.test(?!\/privacy)/,
    'no family name, child or email',
  );
});

test('OD-03 a setting changed here applies at once, says where it comes from, and goes back to .env', async () => {
  let D = (await dash()).json;
  assert.equal(setting(D, 'SIGNUP_MODE').source, 'env');
  assert.equal(setting(D, 'TERMS_URL').source, 'default');
  assert.equal(setting(D, 'PRIVACY_URL').value, 'https://example.test/privacy');
  // Closed: a stranger can't start a family.
  await assert.rejects(srv.newFamily(), /sign-in failed/);
  let r = await set('SIGNUP_MODE', 'open');
  assert.equal(r.status, 200);
  D = r.json;
  assert.equal(D.signupMode, 'open');
  assert.equal(setting(D, 'SIGNUP_MODE').source, 'dashboard');
  assert.equal(setting(D, 'SIGNUP_MODE').env, 'closed');
  assert.equal((await srv.api(jar(), '/api/config')).json.signupMode, 'open');
  await srv.newFamily(); // now anyone may
  r = await set('PRIVACY_URL', 'https://example.test/new-privacy');
  assert.equal(
    (await srv.api(jar(), '/api/config')).json.privacyUrl,
    'https://example.test/new-privacy',
  );
  // Back to .env.
  D = (await reset('SIGNUP_MODE')).json;
  assert.equal(D.signupMode, 'closed');
  assert.equal(setting(D, 'SIGNUP_MODE').source, 'env');
  await assert.rejects(srv.newFamily(), /sign-in failed/);
  D = (await reset('PRIVACY_URL')).json;
  assert.equal(setting(D, 'PRIVACY_URL').value, 'https://example.test/privacy');
  assert.equal(
    srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM settings').get().n),
    0,
  );
});

test('OD-04 bad values, unknown keys and settings that stay in .env are refused', async () => {
  for (const [key, value] of [
    ['SIGNUP_MODE', 'everyone'],
    ['LIMIT_FAMILIES', '0'],
    ['LIMIT_FAMILIES', '2.5'],
    ['DELETE_IDLE_FAMILIES_DAYS', '10'],
    ['SIGNUP_CONTACT_URL', 'http://example.test'],
    ['PRIVACY_URL', 'javascript:alert(1)'],
    ['PARENT_ALLOWLIST', 'not an entry'],
    ['TOUR_VIDEO', 'yes'],
    ['LIMIT_CHILDREN', '-1'],
  ]) {
    const r = await set(key, value);
    assert.equal(r.status, 400, `${key}=${value}`);
    assert.ok(r.json.detail, 'says why');
  }
  for (const key of [
    'SESSION_SECRET',
    'OPERATOR_ALLOWLIST',
    'APP_BASE_URL',
    'GOOGLE_CLIENT_SECRET',
    'SMTP_PASS',
    'DEMO_FAMILIES',
    'NOTIFY_EVENTS',
  ])
    assert.equal((await set(key, 'x')).status, 404, `${key} stays in .env (or is off)`);
  const D = (await dash()).json;
  assert.ok(
    !D.settings.some((s) => s.key === 'NOTIFY_EVENTS'),
    'no operator emails here, so no choice',
  );
  assert.equal(
    srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM settings').get().n),
    0,
  );
});

test('OD-05 per-family limits: .env, the dashboard, and the sign-up mode default', async () => {
  let D = (await dash()).json;
  assert.equal(setting(D, 'LIMIT_CHILDREN').value, '5', 'from .env');
  assert.equal(setting(D, 'LIMIT_PARENTS').value, '');
  assert.equal(setting(D, 'LIMIT_PARENTS').modeDefault, 10, 'closed: the generous default');
  D = (await set('SIGNUP_MODE', 'open')).json;
  assert.equal(setting(D, 'LIMIT_PARENTS').modeDefault, 6, 'open: the tighter default');
  // A family may have one child when the dashboard says so.
  await set('LIMIT_CHILDREN', '1');
  const f = await srv.newFamily();
  const r = await srv.api(f.jar, '/api/child/save', { name: 'Second' });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, 'limitReached');
  await reset('LIMIT_CHILDREN');
  assert.equal((await srv.api(f.jar, '/api/child/save', { name: 'Second' })).status, 200);
  await reset('SIGNUP_MODE');
});

test('OD-06 a family cap and allowlist set here hold after a restart; a stored value the app cannot read falls back to .env', async () => {
  const cap = (await dash()).json.stats.families + 1; // room for exactly one more
  await set('LIMIT_FAMILIES', String(cap));
  await set('PARENT_ALLOWLIST', 'google:new@example.test');
  srv.sql((db) =>
    db
      .prepare(
        "INSERT INTO settings(key, value, updated) VALUES('TERMS_URL', 'ftp://nope', '2026-01-01')",
      )
      .run(),
  );
  await srv.restart();
  assert.ok((await srv.signIn(op, 'google', OP)).ok);
  const D = (await dash()).json;
  assert.equal(D.familyLimit, cap);
  assert.equal(setting(D, 'LIMIT_FAMILIES').source, 'dashboard');
  assert.equal(setting(D, 'TERMS_URL').value, '', 'the unreadable value is ignored');
  assert.match(srv.output(), /Ignoring the dashboard's TERMS_URL/);
  // The allowlisted account may start a family (the cap allows it), a stranger still not.
  await srv.newFamily({ who: { sub: 'new-1', email: 'new@example.test', name: 'New' } });
  await assert.rejects(srv.newFamily(), /sign-in failed/);
  for (const k of ['LIMIT_FAMILIES', 'PARENT_ALLOWLIST', 'TERMS_URL']) await reset(k);
});

test('OD-07 the dashboard page is served under the strict policy', async () => {
  for (const file of ['operator.html', 'operator.js', 'operator.css']) {
    const r = await fetch(`${srv.base}/${file}`);
    assert.equal(r.status, 200, file);
  }
  const r = await fetch(`${srv.base}/operator.html`);
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  const html = await r.text();
  assert.doesNotMatch(html, /\sstyle=|<script>|\son\w+=/i);
});
