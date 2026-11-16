// The startup check: the server refuses unsafe or unreadable configuration before it opens
// (or creates) any database file.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startFails, startServer, tmpDir, removeDir, SECRET } = require('./helpers');

const GOOD = {
  APP_BASE_URL: 'https://little.example.test',
  SESSION_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
};
const LOCAL = { APP_BASE_URL: 'http://localhost:3999', LITTLE_WINS_FAKE_SSO: '1' };

test('the server refuses unsafe or unreadable configuration and creates no database', async () => {
  const dir = tmpDir('startup');
  const db = path.join(dir, 'refused.db');
  const cases = [
    [
      'a plain http APP_BASE_URL off localhost',
      { ...GOOD, APP_BASE_URL: 'http://little.example.test' },
      /must start with https/,
    ],
    ['an unparseable APP_BASE_URL', { ...GOOD, APP_BASE_URL: 'not a url' }, /not a valid URL/],
    [
      'a short SESSION_SECRET off localhost',
      { ...GOOD, SESSION_SECRET: 'short' },
      /SESSION_SECRET must be at least 32/,
    ],
    [
      'a missing SESSION_SECRET off localhost',
      { ...GOOD, SESSION_SECRET: undefined },
      /SESSION_SECRET must be at least 32/,
    ],
    [
      'a placeholder SESSION_SECRET',
      { ...GOOD, SESSION_SECRET: 'change-this-long-random-string' },
      /SESSION_SECRET/,
    ],
    ['the change-me placeholder', { ...GOOD, SESSION_SECRET: 'change-me' }, /SESSION_SECRET/],
    [
      'a short SESSION_SECRET even on localhost',
      { ...LOCAL, SESSION_SECRET: 'short' },
      /SESSION_SECRET must be at least 32/,
    ],
    [
      'fake sign-in off localhost',
      { ...GOOD, LITTLE_WINS_FAKE_SSO: '1' },
      /LITTLE_WINS_FAKE_SSO is only allowed/,
    ],
    [
      'a Google client id without its secret',
      { ...GOOD, GOOGLE_CLIENT_SECRET: undefined },
      /GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together/,
    ],
    [
      'a GitHub client secret without its id',
      { ...GOOD, GITHUB_CLIENT_SECRET: 'x' },
      /GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set together/,
    ],
    [
      'a bad SIGNUP_MODE',
      { ...GOOD, SIGNUP_MODE: 'wide-open' },
      /SIGNUP_MODE must be closed, invite or open \(got "wide-open"\)/,
    ],
    [
      'an unreadable PARENT_ALLOWLIST entry',
      { ...GOOD, PARENT_ALLOWLIST: 'google:a@example.test,nonsense' },
      /PARENT_ALLOWLIST has an entry it can't read: "nonsense"/,
    ],
    [
      'an allowlist type that does not exist',
      { ...GOOD, PARENT_ALLOWLIST: 'facebook:x' },
      /can't read: "facebook:x"/,
    ],
    [
      'no sign-in provider off localhost',
      { ...GOOD, GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined },
      /Configure at least one sign-in provider/,
    ],
  ];
  for (const [name, env, expected] of cases) {
    const vars = { PORT: '0', DATABASE_PATH: db, ...env };
    for (const k of Object.keys(vars)) if (vars[k] === undefined) delete vars[k];
    const r = await startFails(vars);
    assert.equal(r.code, 1, name);
    assert.match(r.out, /Refusing to start/, name);
    assert.match(r.out, expected, name);
  }
  assert.deepEqual(
    fs.readdirSync(dir),
    [],
    'no database (or WAL file) was created by a refused start',
  );
  removeDir(dir);
});

test('a refusal lists every problem at once', async () => {
  const r = await startFails({
    PORT: '0',
    DATABASE_PATH: path.join(tmpDir('startup'), 'x.db'),
    APP_BASE_URL: 'http://little.example.test',
    SESSION_SECRET: 'short',
    SIGNUP_MODE: 'nope',
  });
  for (const m of [/https/, /SESSION_SECRET/, /SIGNUP_MODE/, /Configure at least one/])
    assert.match(r.out, m);
});

test('a valid https configuration starts, and the config endpoint reports it', async () => {
  const srv = await startServer({
    env: {
      APP_BASE_URL: GOOD.APP_BASE_URL,
      LITTLE_WINS_FAKE_SSO: undefined,
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
      SIGNUP_MODE: 'invite',
    },
  });
  try {
    const cfg = (await srv.api(null, '/api/config')).json;
    assert.deepEqual(cfg.providers, ['google']);
    assert.equal(cfg.signupMode, 'invite');
    assert.ok(fs.existsSync(srv.dbPath), 'a started server creates its database');
    const login = await fetch(`${srv.base}/auth/google/login`, { redirect: 'manual' });
    assert.equal(login.status, 303);
    assert.match(login.headers.get('location'), /^https:\/\/accounts\.google\.com\//);
    assert.match(login.headers.get('set-cookie'), /Secure/, 'cookies are Secure off localhost');
    assert.equal(
      (await fetch(`${srv.base}/auth/github/login`, { redirect: 'manual' })).status,
      404,
      'a provider that is not configured is unknown',
    );
    assert.equal(
      (await fetch(`${srv.base}/_fake-sso/google/authorize`)).status,
      404,
      'no fake provider',
    );
  } finally {
    await srv.close();
  }
});

test('localhost development works with a random secret and the fake provider', async () => {
  const srv = await startServer({ env: { SESSION_SECRET: undefined } });
  try {
    assert.deepEqual((await srv.api(null, '/api/config')).json.providers.sort(), [
      'github',
      'google',
    ]);
    assert.match(srv.output(), /fake sign-in is ON/);
  } finally {
    await srv.close();
  }
});
