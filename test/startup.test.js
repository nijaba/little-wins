// The startup check: the server refuses unsafe or unreadable configuration before it opens
// (or creates) any database file.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startFails, startServer, hostedEnv, raw, tmpDir, removeDir, SECRET } = require('./helpers');

const GOOD = {
  APP_BASE_URL: 'https://little.example.test',
  SESSION_SECRET: SECRET,
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
};
const LOCAL = { APP_BASE_URL: 'http://localhost:3999', LITTLE_WINS_FAKE_SSO: '1' };

test('SV-03 the server refuses unsafe or unreadable configuration and creates no database', async () => {
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

test('SV-04 a refusal lists every problem at once', async () => {
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

test('SV-05 a valid https configuration starts, and the config endpoint reports it', async () => {
  const srv = await startServer({
    env: hostedEnv({ SIGNUP_MODE: 'invite', FORWARDED_ALLOW_IPS: '127.0.0.1,::1' }),
  });
  // Behind a trusted proxy that says the request came in over https, the app answers normally.
  const viaProxy = { 'X-Forwarded-Proto': 'https' };
  try {
    const cfg = (await srv.api(null, '/api/config', undefined, { headers: viaProxy })).json;
    assert.deepEqual(cfg.providers, ['google']);
    assert.equal(cfg.signupMode, 'invite');
    assert.ok(fs.existsSync(srv.dbPath), 'a started server creates its database');
    const login = await fetch(`${srv.base}/auth/google/login`, {
      redirect: 'manual',
      headers: viaProxy,
    });
    assert.equal(login.status, 303);
    assert.match(login.headers.get('location'), /^https:\/\/accounts\.google\.com\//);
    assert.match(login.headers.get('set-cookie'), /Secure/, 'cookies are Secure off localhost');
    assert.equal(
      (await fetch(`${srv.base}/auth/github/login`, { redirect: 'manual', headers: viaProxy }))
        .status,
      404,
      'a provider that is not configured is unknown',
    );
    assert.equal(
      (await fetch(`${srv.base}/_fake-sso/google/authorize`, { headers: viaProxy })).status,
      404,
      'no fake provider',
    );
  } finally {
    await srv.close();
  }
});

test('ED-17 outside localhost, plain http is redirected to APP_BASE_URL and only /healthz answers', async () => {
  const srv = await startServer({ env: hostedEnv() });
  try {
    for (const [p, hostile] of [
      ['/', 'evil.example'],
      ['/api/state?week=2024-01-01', 'evil.example'],
      ['/auth/google/login', 'evil.example:8080'],
    ]) {
      const r = await raw(srv, p, { headers: { Host: hostile } });
      assert.equal(r.status, 308, p);
      assert.equal(
        r.headers.get('location'),
        `https://little.example.test${p}`,
        `${p}: the redirect uses APP_BASE_URL, never the Host header`,
      );
      assert.ok(!r.headers.get('location').includes('evil'), 'the Host is never echoed');
    }
    const post = await raw(srv, '/api/logout', {
      method: 'POST',
      headers: { Host: 'evil.example', 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(post.status, 308, 'writes are redirected too, never handled over http');
    const plain = await fetch(`${srv.base}/api/config`, { redirect: 'manual' });
    assert.equal(plain.status, 308);
    assert.equal(plain.headers.get('location'), 'https://little.example.test/api/config');

    const health = await raw(srv, '/healthz', { headers: { Host: 'evil.example' } });
    assert.equal(health.status, 200, '/healthz answers over plain http');
    assert.deepEqual(JSON.parse(health.text), { status: 'ok' });
  } finally {
    await srv.close();
  }
});

test('ED-18 X-Forwarded-Proto: https from an untrusted peer does not lift the redirect', async () => {
  for (const FORWARDED_ALLOW_IPS of [undefined, '10.1.2.3']) {
    const srv = await startServer({ env: hostedEnv({ FORWARDED_ALLOW_IPS }) });
    try {
      const r = await raw(srv, '/api/config', { headers: { 'X-Forwarded-Proto': 'https' } });
      assert.equal(r.status, 308, `FORWARDED_ALLOW_IPS=${FORWARDED_ALLOW_IPS}`);
    } finally {
      await srv.close();
    }
  }
});

test('ED-19 behind a trusted proxy that forwards https, the API answers normally', async () => {
  for (const FORWARDED_ALLOW_IPS of ['127.0.0.1', '*']) {
    const srv = await startServer({ env: hostedEnv({ FORWARDED_ALLOW_IPS }) });
    try {
      const headers = { 'X-Forwarded-Proto': 'https', Host: 'little.example.test' };
      const r = await raw(srv, '/api/config', { headers });
      assert.equal(r.status, 200, `FORWARDED_ALLOW_IPS=${FORWARDED_ALLOW_IPS}`);
      assert.deepEqual(JSON.parse(r.text).providers, ['google']);
      assert.equal((await raw(srv, '/', { headers })).status, 200, 'the page too');
      const plain = await raw(srv, '/api/config', {
        headers: { 'X-Forwarded-Proto': 'http', Host: 'little.example.test' },
      });
      assert.equal(plain.status, 308, 'a proxy that says http is still redirected');
    } finally {
      await srv.close();
    }
  }
});

test('SV-06 localhost development works with a random secret and the fake provider', async () => {
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
