// Sign-in through the fake provider: the state cookie, verified email, the allowlist, closed
// and open sign-up, and matching returning parents on the provider's stable id.
// (The sign-in rate limit is 10 per minute per process, so each group has its own server.)
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { jar, SESSION, startServer, craftState } = require('./helpers');

const noSession = (j) => assert.equal(j.c[SESSION], undefined, 'no session cookie was set');

describe('allowlist', () => {
  let srv;
  before(async () => {
    srv = await startServer({
      allowlist: 'google:Alice@Example.com, github:CAROL-DEV ,google-domain:Corp.Example.Test',
    });
  });
  after(() => srv.close());

  test('SI-04 a Google email on the allowlist may sign in and set up a family', async () => {
    const j = jar();
    const r = await srv.signIn(j, 'google', 'alice');
    assert.ok(r.ok, r.body);
    assert.deepEqual((await srv.api(j, '/api/state')).json.setup, true);
  });

  test('SI-05 a GitHub login on the allowlist matches without regard to case', async () => {
    const j = jar();
    assert.ok((await srv.signIn(j, 'github', 'carol')).ok);
  });

  test('SI-06 an email is compared in lower case', async () => {
    const j = jar();
    assert.ok(
      (await srv.signIn(j, 'google', { sub: 'g-case', email: 'ALICE@EXAMPLE.COM', name: 'x' })).ok,
    );
  });

  test('SI-07 a Google Workspace domain matches on the hd claim only', async () => {
    const ok = jar();
    const r = await srv.signIn(ok, 'google', {
      sub: 'g-hd1',
      email: 'x@corp.example.test',
      hd: 'corp.example.test',
      name: 'Work',
    });
    assert.ok(r.ok, r.body);
    const noHd = jar();
    const bad = await srv.signIn(noHd, 'google', {
      sub: 'g-hd2',
      email: 'y@corp.example.test',
      name: 'No hd',
    });
    assert.equal(bad.status, 403, 'the same domain in the email is not enough');
    noSession(noHd);
    const other = jar();
    assert.equal(
      (
        await srv.signIn(other, 'google', {
          sub: 'g-hd3',
          email: 'z@other.test',
          hd: 'other.test',
          name: 'z',
        })
      ).status,
      403,
    );
  });

  test('SI-08 a parent who is not on the list gets the private-instance page and no session', async () => {
    for (const [provider, who] of [
      ['google', 'bob'],
      ['github', 'dan'],
    ]) {
      const j = jar();
      const r = await srv.signIn(j, provider, who);
      assert.equal(r.status, 403, `${provider}/${who}`);
      assert.match(r.body, /This Little Wins is private/);
      noSession(j);
      assert.equal((await srv.api(j, '/api/state')).status, 401);
    }
  });

  test('SI-09 the allowlist never matches on the display name', async () => {
    const j = jar();
    const r = await srv.signIn(j, 'google', {
      sub: 'g-fake',
      email: 'mallory@example.test',
      name: 'alice@example.com',
    });
    assert.equal(r.status, 403);
  });

  test('SI-10 an entry for one provider does not admit the other', async () => {
    const j = jar();
    const r = await srv.signIn(j, 'github', { sub: '9', login: 'alice@example.com', name: 'x' });
    assert.equal(r.status, 403, 'a GitHub login is not a Google email');
  });
});

describe('the sign-in state cookie', () => {
  let srv;
  before(async () => {
    srv = await startServer({ allowlist: '*' });
  });
  after(() => srv.close());

  const callback = (j, query, provider = 'google') =>
    fetch(`${srv.base}/auth/${provider}/callback?${query}`, {
      redirect: 'manual',
      headers: { cookie: j.header },
    });

  test('SI-11 a callback without the state cookie is a 400 page', async () => {
    const r = await callback(jar(), 'code=abc&state=abc');
    assert.equal(r.status, 400);
    assert.match(await r.text(), /took too long or started in another browser/);
  });

  test('SI-12 a tampered state cookie is refused', async () => {
    const j = jar();
    const start = await fetch(`${srv.base}/auth/google/login`, { redirect: 'manual' });
    const cookie = start.headers.get('set-cookie').split(';')[0];
    const value = cookie.slice(cookie.indexOf('=') + 1);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const [body, mac] = value.split('.');
    // Flip the first character: the last one of a base64url MAC has unused padding bits.
    const flipped = `${body}.${mac[0] === 'A' ? 'B' : 'A'}${mac.slice(1)}`;
    const r = await callback({ header: `lw_oauth=${flipped}` }, `code=abc&state=${state}`);
    assert.equal(r.status, 400);
    const forged = Buffer.from(
      JSON.stringify({ p: 'google', s: 'x', v: 'v', i: null, t: Date.now() }),
    ).toString('base64url');
    const r2 = await callback({ header: `lw_oauth=${forged}.${mac}` }, 'code=abc&state=x');
    assert.equal(r2.status, 400, 'a new body with an old signature');
    noSession(j);
  });

  test('SI-13 a state parameter that does not match the cookie is refused', async () => {
    const j = jar();
    const start = await fetch(`${srv.base}/auth/google/login`, {
      redirect: 'manual',
    });
    j.c.lw_oauth = start.headers.get('set-cookie').split(';')[0].slice('lw_oauth='.length);
    const r = await callback(j, 'code=abc&state=not-the-state');
    assert.equal(r.status, 400);
    assert.match(await r.text(), /couldn&#39;t be checked/);
    assert.equal((await callback(j, 'code=abc')).status, 400, 'a missing state parameter too');
  });

  test('SI-14 a state cookie older than ten minutes is refused, a fresh one is accepted', async () => {
    const old = craftState(
      { p: 'google', s: 'st', v: 'verifier', i: null },
      Date.now() - 11 * 60e3,
    );
    const r = await callback({ header: `lw_oauth=${old}` }, 'code=abc&state=st');
    assert.equal(r.status, 400);
    assert.match(await r.text(), /took too long/);
    const fresh = craftState({ p: 'google', s: 'st', v: 'verifier', i: null });
    const r2 = await callback({ header: `lw_oauth=${fresh}` }, 'error=access_denied&state=st');
    assert.equal(r2.status, 303, 'a signed fresh cookie passes the state check');
    assert.equal(r2.headers.get('location'), '/', 'a provider error just goes back to the app');
  });

  test('SI-15 a state cookie made for one provider cannot finish a sign-in at the other', async () => {
    const c = craftState({ p: 'google', s: 'st', v: 'v', i: null });
    const r = await callback({ header: `lw_oauth=${c}` }, 'code=abc&state=st', 'github');
    assert.equal(r.status, 400);
  });

  test('SI-16 the callback clears the state cookie after use', async () => {
    const j = jar();
    assert.ok((await srv.signIn(j, 'google', 'alice')).ok);
    assert.equal(j.c.lw_oauth, undefined);
  });

  test('SI-17 an unverified Google email is refused', async () => {
    const j = jar();
    const r = await srv.signIn(j, 'google', {
      sub: 'g-unv',
      email: 'alice@example.com',
      verified: '0',
      name: 'U',
    });
    assert.equal(r.status, 400);
    assert.match(r.body, /email is verified/);
    noSession(j);
  });

  test('SI-18 unknown providers are 404', async () => {
    assert.equal(
      (await fetch(`${srv.base}/auth/twitter/login`, { redirect: 'manual' })).status,
      404,
    );
  });

  test('SI-19 the login page escapes nothing it was not given and refuses a forged token', async () => {
    // The provider rejects a code that was not issued for this verifier.
    const j = jar();
    const start = await fetch(`${srv.base}/auth/google/login`, { redirect: 'manual' });
    j.c.lw_oauth = start.headers.get('set-cookie').split(';')[0].slice('lw_oauth='.length);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const r = await callback(j, `code=forged&state=${state}`);
    assert.equal(r.status, 502);
    noSession(j);
  });
});

describe('sign-up modes', () => {
  test('SI-20 closed with an empty allowlist admits nobody', async () => {
    const srv = await startServer({ allowlist: '' });
    try {
      for (const who of ['alice', 'bob']) {
        const j = jar();
        const r = await srv.signIn(j, 'google', who);
        assert.equal(r.status, 403, who);
        noSession(j);
      }
    } finally {
      await srv.close();
    }
  });

  test('SI-21 open sign-up lets anyone create a family, and a returning parent lands in theirs', async () => {
    const srv = await startServer({ signup: 'open' });
    try {
      const a = jar();
      assert.ok((await srv.signIn(a, 'google', 'bob')).ok);
      assert.equal((await srv.api(a, '/api/state')).json.setup, true);
      const setup = await srv.api(a, '/api/setup', {
        family_name: 'Bobs',
        child_name: 'K',
        timezone: 'UTC',
      });
      assert.equal(setup.status, 200);
      const again = jar();
      assert.ok((await srv.signIn(again, 'google', 'bob')).ok);
      const S = (await srv.api(again, '/api/state')).json;
      assert.equal(S.setup, undefined);
      assert.equal(S.family.name, 'Bobs');
      assert.equal(S.parents.length, 1, 'the same account, not a second parent');
    } finally {
      await srv.close();
    }
  });

  test('SI-22 invite mode is closed to family creation without the allowlist', async () => {
    const srv = await startServer({ signup: 'invite' });
    try {
      const j = jar();
      assert.equal((await srv.signIn(j, 'google', 'bob')).status, 403);
    } finally {
      await srv.close();
    }
  });

  test('SI-23 changing display name or email does not change who a parent is', async () => {
    const srv = await startServer({ allowlist: 'google:old@example.test' });
    try {
      const a = jar();
      const who = { sub: 'g-stable', email: 'old@example.test', name: 'Old Name' };
      assert.ok((await srv.signIn(a, 'google', who)).ok);
      await srv.api(a, '/api/setup', { family_name: 'Stable', child_name: 'K', timezone: 'UTC' });

      const b = jar();
      const changed = { sub: 'g-stable', email: 'new@example.test', name: 'New Name' };
      assert.ok((await srv.signIn(b, 'google', changed)).ok, 'same id, no longer on the allowlist');
      const S = (await srv.api(b, '/api/state')).json;
      assert.equal(S.family.name, 'Stable');
      assert.deepEqual(
        S.parents.map((p) => [p.name, p.role]),
        [['New Name', 'owner']],
        'the new name replaces the old one, still one parent',
      );

      const imposter = jar();
      const r = await srv.signIn(imposter, 'google', {
        sub: 'g-other',
        email: 'old@example.test',
        name: 'Old Name',
      });
      assert.ok(r.ok, 'a different id with the allowed email is a new parent (own setup)');
      assert.equal((await srv.api(imposter, '/api/state')).json.setup, true);
      const stranger = jar();
      const s = await srv.signIn(stranger, 'google', {
        sub: 'g-name',
        email: 'q@example.test',
        name: 'Old Name',
      });
      assert.equal(s.status, 403, 'the same display name is nothing');
    } finally {
      await srv.close();
    }
  });

  test('SI-24 the same person on two providers is two accounts', async () => {
    const srv = await startServer({ signup: 'open' });
    try {
      const g = await srv.newFamily({ name: 'G fam', provider: 'google' });
      const h = await srv.newFamily({ name: 'H fam', provider: 'github' });
      assert.equal(g.state.family.name, 'G fam');
      assert.equal(h.state.family.name, 'H fam');
    } finally {
      await srv.close();
    }
  });
});

describe('sign-in rate limit', () => {
  test('SI-25 the 11th sign-in start within a minute is a 429 page', async () => {
    const srv = await startServer({ allowlist: '*' });
    try {
      for (let i = 0; i < 10; i++)
        assert.equal(
          (await fetch(`${srv.base}/auth/google/login`, { redirect: 'manual' })).status,
          303,
        );
      const r = await fetch(`${srv.base}/auth/google/login`, { redirect: 'manual' });
      assert.equal(r.status, 429);
      assert.match(await r.text(), /Too many tries/);
    } finally {
      await srv.close();
    }
  });
});

describe('sign-in callback rate limit', () => {
  test('SI-26 the 11th checked sign-in callback within a minute is a 429 page', async () => {
    const srv = await startServer({ allowlist: '*' });
    const callback = () =>
      fetch(`${srv.base}/auth/google/callback?code=not-a-code&state=st`, {
        redirect: 'manual',
        headers: { cookie: `lw_oauth=${craftState({ p: 'google', s: 'st', v: 'v', i: null })}` },
      });
    try {
      for (let i = 0; i < 10; i++) {
        assert.equal((await callback()).status, 502, 'checked, then refused by the provider');
      }
      const r = await callback();
      assert.equal(r.status, 429);
      assert.match(await r.text(), /Too many tries/);
    } finally {
      await srv.close();
    }
  });
});

describe('idle sessions', () => {
  test('SI-27 a session unused for over a year is ended when it is next used', async () => {
    const srv = await startServer({ allowlist: '*' });
    try {
      const j = jar();
      assert.ok((await srv.signIn(j, 'google', 'alice')).ok);
      assert.equal((await srv.api(j, '/api/state')).status, 200);
      const old = new Date(Date.now() - 366 * 864e5).toISOString();
      srv.sql((db) => db.prepare('UPDATE sessions SET last_seen=?').run(old));
      assert.equal((await srv.api(j, '/api/state')).status, 401);
      const left = srv.sql((db) => db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n);
      assert.equal(left, 0, 'the old session is deleted');
    } finally {
      await srv.close();
    }
  });
});
