// The edge of the server: security headers on every response, which proxies are believed,
// the per-client API rate limits, and the legal-page links in /api/config.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, startFails, hostedEnv, raw, tmpDir, removeDir } = require('./helpers');
const path = require('node:path');

const TRUSTED = '127.0.0.1,::1'; // how a local peer shows up, over IPv4 or IPv6

// --- Security headers ----------------------------------------------------------------------
const ALWAYS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
};

function checkHeaders(res, label, { hsts }) {
  for (const [k, v] of Object.entries(ALWAYS))
    assert.equal(res.headers.get(k), v, `${label}: ${k}`);
  assert.match(res.headers.get('referrer-policy') || '', /\S/, `${label}: Referrer-Policy`);
  const perms = res.headers.get('permissions-policy') || '';
  for (const feature of ['camera=()', 'microphone=()', 'geolocation=()'])
    assert.ok(perms.includes(feature), `${label}: Permissions-Policy has ${feature}`);
  if (hsts)
    assert.match(res.headers.get('strict-transport-security') || '', /max-age=\d{7,}/, label);
  else
    assert.equal(
      res.headers.get('strict-transport-security'),
      null,
      `${label}: no HSTS on localhost`,
    );
}

/** One request of every kind of response the server makes. */
const KINDS = [
  ['page', 'GET', '/'],
  ['static js', 'GET', '/app.js'],
  ['static css', 'GET', '/style.css'],
  ['API JSON', 'GET', '/api/config'],
  ['API 401', 'GET', '/api/state'],
  ['API 404', 'GET', '/api/nope'],
  ['API write refusal (415)', 'POST', '/api/logout'],
  ['static 404', 'GET', '/nope.txt'],
  ['405', 'POST', '/'],
  ['sign-in fail page', 'GET', '/auth/google/callback'],
  ['unknown provider page', 'GET', '/auth/github/login'],
  ['healthz', 'GET', '/healthz'],
];

test('ED-08 every kind of response on localhost carries the security headers and no HSTS', async () => {
  const srv = await startServer();
  try {
    for (const [label, method, p] of KINDS) {
      const res = await raw(srv, p, { method });
      assert.ok(
        [200, 303, 400, 401, 404, 405, 415].includes(res.status),
        `${label}: ${res.status}`,
      );
      checkHeaders(res, label, { hsts: false });
    }
  } finally {
    await srv.close();
  }
});

test('ED-09 outside localhost every response carries the headers plus HSTS, redirects included', async () => {
  const srv = await startServer({ env: hostedEnv({ FORWARDED_ALLOW_IPS: TRUSTED }) });
  try {
    const https = { 'X-Forwarded-Proto': 'https' };
    for (const [label, method, p] of KINDS) {
      checkHeaders(await raw(srv, p, { method, headers: https }), label, { hsts: true });
    }
    const redirect = await raw(srv, '/');
    assert.equal(redirect.status, 308);
    checkHeaders(redirect, 'the http redirect', { hsts: true });
  } finally {
    await srv.close();
  }
});

// --- Trusted proxies -----------------------------------------------------------------------
/** Ten pair attempts from one client use up its budget; the 11th is refused. */
async function burn(srv, forwardedFor) {
  const headers = forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {};
  let last;
  for (let i = 0; i < 11; i++) last = await srv.api(null, '/api/pair', { code: 'x' }, { headers });
  return last.status;
}
const attempt = async (srv, forwardedFor) =>
  (
    await srv.api(
      null,
      '/api/pair',
      { code: 'x' },
      { headers: { 'X-Forwarded-For': forwardedFor } },
    )
  ).status;

test('ED-10 X-Forwarded-For from an untrusted peer is ignored: one budget for the peer', async () => {
  for (const FORWARDED_ALLOW_IPS of [undefined, '10.9.8.7']) {
    const srv = await startServer({ env: { FORWARDED_ALLOW_IPS } });
    try {
      for (let i = 0; i < 10; i++) {
        const r = await srv.api(
          null,
          '/api/pair',
          { code: 'x' },
          { headers: { 'X-Forwarded-For': `203.0.113.${i}` } },
        );
        assert.equal(r.status, 400, 'a wrong code, inside the budget');
      }
      assert.equal(
        await attempt(srv, '198.51.100.99'),
        429,
        `a fresh forwarded address does not give a fresh budget (FORWARDED_ALLOW_IPS=${FORWARDED_ALLOW_IPS})`,
      );
    } finally {
      await srv.close();
    }
  }
});

test('ED-11 from a trusted proxy each forwarded client has its own budget, using the LAST entry', async () => {
  const srv = await startServer({ env: { FORWARDED_ALLOW_IPS: TRUSTED } });
  try {
    assert.equal(await burn(srv, '203.0.113.1'), 429, 'client 1 used up its budget');
    assert.equal(await attempt(srv, '203.0.113.2'), 400, 'client 2 still has its own');
    // A client that puts its own address first cannot dodge the limit: the proxy's entry is last.
    assert.equal(await attempt(srv, '198.51.100.7, 203.0.113.1'), 429);
    assert.equal(await attempt(srv, '198.51.100.8, 203.0.113.1'), 429);
    assert.equal(await attempt(srv, '10.0.0.1,203.0.113.1'), 429);
    // ...and a different last entry is a different client, whatever comes first.
    assert.equal(await attempt(srv, '203.0.113.1, 203.0.113.3'), 400);
    // No header: the peer itself, which has its own budget.
    assert.equal(
      (await srv.api(null, '/api/pair', { code: 'x' })).status,
      400,
      'the proxy itself is another client',
    );
  } finally {
    await srv.close();
  }
});

test('ED-12 the forwarded address also governs sign-in attempts', async () => {
  const srv = await startServer({ env: { FORWARDED_ALLOW_IPS: '*' } });
  try {
    const login = (xff) =>
      fetch(`${srv.base}/auth/google/login`, {
        redirect: 'manual',
        headers: { 'X-Forwarded-For': xff },
      }).then((r) => r.status);
    for (let i = 0; i < 10; i++) assert.equal(await login('203.0.113.1'), 303);
    assert.equal(await login('203.0.113.1'), 429);
    assert.equal(await login('198.51.100.1, 203.0.113.1'), 429, 'a spoofed first entry');
    assert.equal(await login('203.0.113.9'), 303, 'another client is fine');
  } finally {
    await srv.close();
  }
});

// --- API rate limits -----------------------------------------------------------------------
test('ED-13 the 601st API read within a minute is refused with Retry-After', async () => {
  const srv = await startServer();
  try {
    for (let i = 0; i < 600; i++) {
      const r = await fetch(`${srv.base}/api/config`);
      await r.arrayBuffer();
      assert.equal(r.status, 200, `read ${i + 1}`);
    }
    const r = await srv.api(null, '/api/config');
    assert.equal(r.status, 429);
    assert.ok(+r.headers.get('retry-after') >= 1 && +r.headers.get('retry-after') <= 60);
    assert.equal(typeof r.json.error, 'string');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', 'a 429 has the headers');
    assert.equal((await fetch(`${srv.base}/healthz`)).status, 200, 'health checks are not limited');
    assert.equal((await fetch(`${srv.base}/`)).status, 200, 'nor is the page');
    assert.equal(
      (await srv.api(null, '/api/logout', {})).status,
      401,
      'writes have their own budget',
    );
  } finally {
    await srv.close();
  }
});

test('ED-14 the 121st API write within a minute is refused with Retry-After', async () => {
  const srv = await startServer();
  try {
    for (let i = 0; i < 120; i++) {
      const r = await srv.api(null, '/api/logout', {});
      assert.equal(r.status, 401, `write ${i + 1}`);
    }
    const r = await srv.api(null, '/api/logout', {});
    assert.equal(r.status, 429);
    assert.ok(+r.headers.get('retry-after') >= 1 && +r.headers.get('retry-after') <= 60);
    assert.equal((await srv.api(null, '/api/config')).status, 200, 'reads have their own budget');
  } finally {
    await srv.close();
  }
});

test('ED-15 API budgets are per client behind a trusted proxy', async () => {
  const srv = await startServer({ env: { FORWARDED_ALLOW_IPS: TRUSTED } });
  const as = (ip) => ({ headers: { 'X-Forwarded-For': ip } });
  try {
    for (let i = 0; i < 120; i++) await srv.api(null, '/api/logout', {}, as('203.0.113.1'));
    assert.equal((await srv.api(null, '/api/logout', {}, as('203.0.113.1'))).status, 429);
    assert.equal((await srv.api(null, '/api/logout', {}, as('9.9.9.9, 203.0.113.1'))).status, 429);
    assert.equal((await srv.api(null, '/api/logout', {}, as('203.0.113.2'))).status, 401);
  } finally {
    await srv.close();
  }
});

// --- Legal pages ---------------------------------------------------------------------------
test('ED-16 /api/config reports the privacy and terms links, null by default', async () => {
  let srv = await startServer();
  try {
    const cfg = (await srv.api(null, '/api/config')).json;
    assert.equal(cfg.privacyUrl, null);
    assert.equal(cfg.termsUrl, null);
  } finally {
    await srv.close();
  }
  srv = await startServer({
    env: { PRIVACY_URL: 'https://example.test/privacy', TERMS_URL: 'https://example.test/terms' },
  });
  try {
    const cfg = (await srv.api(null, '/api/config')).json;
    assert.equal(cfg.privacyUrl, 'https://example.test/privacy');
    assert.equal(cfg.termsUrl, 'https://example.test/terms');
  } finally {
    await srv.close();
  }
  srv = await startServer({ env: { PRIVACY_URL: 'https://example.test/privacy' } });
  try {
    const cfg = (await srv.api(null, '/api/config')).json;
    assert.equal(cfg.privacyUrl, 'https://example.test/privacy');
    assert.equal(cfg.termsUrl, null, 'each link is independent');
  } finally {
    await srv.close();
  }
});

test('SV-02 an invalid PRIVACY_URL or TERMS_URL refuses to start', async () => {
  const dir = tmpDir('edge');
  const base = {
    PORT: '0',
    DATABASE_PATH: path.join(dir, 'x.db'),
    APP_BASE_URL: 'http://localhost:3999',
  };
  for (const [name, value] of [
    ['PRIVACY_URL', 'javascript:alert(1)'],
    ['PRIVACY_URL', 'example.test/privacy'],
    ['PRIVACY_URL', 'https://exa mple.test'],
    ['TERMS_URL', 'ftp://example.test/terms'],
    ['TERMS_URL', 'not a url'],
  ]) {
    const r = await startFails({ ...base, LITTLE_WINS_FAKE_SSO: '1', [name]: value });
    assert.equal(r.code, 1, `${name}=${value}`);
    assert.match(r.out, new RegExp(`${name} must be an http\\(s\\) URL`));
  }
  removeDir(dir);
});
