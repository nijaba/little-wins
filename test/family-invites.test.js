// Family invites from the operator (SIGNUP_MODE=invite), the cap on families (LIMIT_FAMILIES)
// and the "Ask for a place" contact (SIGNUP_CONTACT_URL).
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { jar, startServer, startFails, tmpDir, removeDir, SECRET } = require('./helpers');

const OP = { sub: 'op-1', email: 'op@example.test', name: 'Olive Operator' };
const OWNER = { sub: 'own-1', email: 'owner@example.test', name: 'Opal Owner' };
const CONTACT = 'mailto:places@example.test';
const tokenOf = (link) => link.split('#signup=')[1];
let n = 0;
const person = () => {
  n++;
  return { sub: `fi-${process.pid}-${n}`, email: `fi${n}@example.test`, name: `Parent ${n}` };
};
const setupBody = { family_name: 'Invited Family', child_name: 'Kid', timezone: 'UTC' };

async function signedIn(srv, who, opts) {
  const j = jar();
  const r = await srv.signIn(j, 'google', who, opts);
  return { j, r };
}

describe('family invites', () => {
  let srv;
  let op;
  before(async () => {
    srv = await startServer({
      signup: 'invite',
      allowlist: 'google:owner@example.test',
      env: { OPERATOR_ALLOWLIST: 'google:op@example.test', SIGNUP_CONTACT_URL: CONTACT },
    });
    op = (await signedIn(srv, OP)).j;
  });
  after(() => srv.close());

  const issue = async () => {
    const r = await srv.api(op, '/api/operator/invite/create', {});
    assert.equal(r.status, 200);
    return r.json;
  };

  test('FI-01 the operator issues a 30-day invite link, sees it listed and stores only its hash', async () => {
    const reply = await issue();
    assert.match(reply.issued.link, /^http:\/\/localhost:\d+\/#signup=[\w-]{32}$/);
    const days = (Date.parse(reply.issued.expires) - Date.now()) / 864e5;
    assert.ok(days > 29.9 && days <= 30, `expires in ${days} days`);
    assert.equal(reply.signupMode, 'invite');
    assert.ok(reply.familyInvites.length >= 1);
    for (const i of reply.familyInvites)
      assert.deepEqual(Object.keys(i).sort(), ['created', 'expires', 'id']);
    const token = tokenOf(reply.issued.link);
    const stored = srv.sql((db) => db.prepare('SELECT token_hash FROM family_invites').all());
    assert.ok(stored.every((r) => r.token_hash !== token && r.token_hash.length === 64));
  });

  test('FI-02 a parent with an invite signs in, sets up a family, and the invite is spent', async () => {
    const token = tokenOf((await issue()).issued.link);
    const info = await srv.api(null, '/api/signup/info', { token });
    assert.equal(info.status, 200);
    assert.deepEqual(info.json, { ok: true, full: false });
    const who = person();
    const { j, r } = await signedIn(srv, who, { signup: token });
    assert.ok(r.ok, r.body);
    const S = (await srv.api(j, '/api/state')).json;
    assert.equal(S.setup, true);
    assert.equal(S.canCreate, true);
    const made = await srv.api(j, '/api/setup', setupBody);
    assert.equal(made.status, 200);
    assert.equal((await srv.api(null, '/api/signup/info', { token })).status, 404, 'used up');
    const row = srv.sql((db) =>
      db
        .prepare(
          'SELECT used_at, family_id FROM family_invites WHERE used_at IS NOT NULL ORDER BY id DESC',
        )
        .get(),
    );
    assert.ok(row.used_at && row.family_id, 'spent on the new family');
  });

  test('FI-03 an invite works once: a second parent with the same link gets the private page', async () => {
    const token = tokenOf((await issue()).issued.link);
    assert.ok((await signedIn(srv, person(), { signup: token })).r.ok);
    const second = await signedIn(srv, person(), { signup: token });
    assert.equal(second.r.status, 403);
    assert.match(second.r.body, /This Little Wins is private/);
  });

  test('FI-04 an invited parent can finish setup later, from another device', async () => {
    const token = tokenOf((await issue()).issued.link);
    const who = person();
    assert.ok((await signedIn(srv, who, { signup: token })).r.ok);
    const later = await signedIn(srv, who); // no link this time
    assert.ok(later.r.ok, later.r.body);
    assert.equal((await srv.api(later.j, '/api/setup', setupBody)).status, 200);
    const again = await signedIn(srv, person());
    assert.equal(again.r.status, 403, 'nobody else inherits it');
  });

  test('FI-05 without an invite a new parent sees the private page with the contact link', async () => {
    const { r } = await signedIn(srv, person());
    assert.equal(r.status, 403);
    assert.match(r.body, /This Little Wins is private/);
    assert.match(r.body, /href="mailto:places@example\.test"[^>]*>Ask for a place</);
    assert.equal((await srv.api(null, '/api/config')).json.contactUrl, CONTACT);
    const forged = await srv.api(null, '/api/signup/info', { token: 'x'.repeat(32) });
    assert.equal(forged.status, 404);
    assert.equal(forged.json.code, 'inviteInvalid');
  });
});

describe('family invites: refusals', () => {
  let srv;
  let op;
  before(async () => {
    srv = await startServer({
      signup: 'invite',
      allowlist: 'google:owner@example.test',
      env: { OPERATOR_ALLOWLIST: 'google:op@example.test', SIGNUP_CONTACT_URL: CONTACT },
    });
    op = (await signedIn(srv, OP)).j;
  });
  after(() => srv.close());

  const issue = async () => {
    const r = await srv.api(op, '/api/operator/invite/create', {});
    assert.equal(r.status, 200);
    return r.json;
  };

  test('FI-06 an expired or cancelled invite does not work, and a used one cannot be cancelled', async () => {
    const expired = tokenOf((await issue()).issued.link);
    srv.sql((db) =>
      db
        .prepare(
          "UPDATE family_invites SET expires='2000-01-01T00:00:00.000Z' WHERE used_at IS NULL",
        )
        .run(),
    );
    assert.equal((await srv.api(null, '/api/signup/info', { token: expired })).status, 404);
    assert.equal((await signedIn(srv, person(), { signup: expired })).r.status, 403);
    const reply = await issue();
    const open = reply.familyInvites.at(-1);
    const after = await srv.api(op, '/api/operator/invite/revoke', { id: open.id });
    assert.equal(after.status, 200);
    assert.ok(!after.json.familyInvites.some((i) => i.id === open.id));
    assert.equal(
      (await signedIn(srv, person(), { signup: tokenOf(reply.issued.link) })).r.status,
      403,
    );
    const spent = tokenOf((await issue()).issued.link);
    assert.ok((await signedIn(srv, person(), { signup: spent })).r.ok);
    const used = srv.sql((db) =>
      db.prepare('SELECT id FROM family_invites WHERE used_at IS NOT NULL').get(),
    );
    assert.equal((await srv.api(op, '/api/operator/invite/revoke', { id: used.id })).status, 404);
  });

  test('FI-07 only operators issue, list or cancel family invites', async () => {
    const owner = (await signedIn(srv, OWNER)).j;
    await srv.api(owner, '/api/setup', setupBody);
    for (const [path, body] of [
      ['/api/operator/invite/create', {}],
      ['/api/operator/invite/revoke', { id: 1 }],
    ]) {
      assert.equal((await srv.api(owner, path, body)).status, 403, `${path} as a parent`);
      assert.equal((await srv.api(jar(), path, body)).status, 401, `${path} signed out`);
    }
    assert.equal((await srv.api(owner, '/api/operator')).status, 403);
  });

  test('FI-08 the allowlist still lets its parents create a family in invite mode', async () => {
    const S = (await srv.api((await signedIn(srv, { ...OWNER, sub: 'own-1' })).j, '/api/state'))
      .json;
    assert.ok(S.family || S.canCreate, 'the allowlisted owner is not refused');
  });
});

describe('the cap on families', () => {
  let srv;
  before(async () => {
    srv = await startServer({
      signup: 'open',
      env: { LIMIT_FAMILIES: '2', OPERATOR_ALLOWLIST: 'google:op@example.test' },
    });
  });
  after(() => srv.close());

  test('FI-09 when the cap is reached a new parent sees the full screen and setup is refused', async () => {
    await srv.newFamily();
    const second = await srv.newFamily();
    const { j, r } = await signedIn(srv, person());
    assert.ok(r.ok, 'signed in, to see the full screen');
    const S = (await srv.api(j, '/api/state')).json;
    assert.equal(S.canCreate, false);
    assert.equal(S.full, true);
    const refused = await srv.api(j, '/api/setup', setupBody);
    assert.equal(refused.status, 409);
    assert.equal(refused.json.code, 'serviceFull');
    // A co-parent can still join an existing family.
    const inv = await srv.api(second.jar, '/api/invite/create', {});
    const coParent = await signedIn(srv, person(), {
      invite: inv.json.issued.link.split('#invite=')[1],
    });
    assert.ok(coParent.r.ok);
    assert.ok((await srv.api(coParent.j, '/api/state')).json.family);
    // Deleting a family makes room again.
    const name = second.state.family.name;
    assert.equal((await srv.api(second.jar, '/api/family/delete', { confirm: name })).status, 200);
    assert.equal((await srv.api(j, '/api/setup', setupBody)).status, 200);
  });

  test('FI-10 the operator page shows the families against the cap', async () => {
    const op = (await signedIn(srv, OP)).j;
    const r = (await srv.api(op, '/api/operator')).json;
    assert.equal(r.familyLimit, 2);
    assert.equal(r.families, 2);
    assert.equal(r.signupMode, 'open');
  });
});

describe('a full installation in invite mode', () => {
  test('FI-11 an invite that meets a full installation is not used up, and works once there is room', async () => {
    const srv = await startServer({
      signup: 'invite',
      allowlist: 'google:owner@example.test',
      env: { LIMIT_FAMILIES: '1', OPERATOR_ALLOWLIST: 'google:op@example.test' },
    });
    try {
      const op = (await signedIn(srv, OP)).j;
      const owner = await srv.newFamily({ who: OWNER });
      const token = tokenOf(
        (await srv.api(op, '/api/operator/invite/create', {})).json.issued.link,
      );
      assert.deepEqual((await srv.api(null, '/api/signup/info', { token })).json, {
        ok: true,
        full: true,
      });
      const who = person();
      const first = await signedIn(srv, who, { signup: token });
      assert.ok(first.r.ok);
      assert.equal((await srv.api(first.j, '/api/state')).json.full, true);
      assert.equal(
        (await srv.api(first.j, '/api/setup', setupBody)).status,
        403,
        'not entitled yet',
      );
      assert.equal(
        (await srv.api(null, '/api/signup/info', { token })).status,
        200,
        'still unused',
      );
      await srv.api(owner.jar, '/api/family/delete', { confirm: owner.state.family.name });
      const second = await signedIn(srv, who, { signup: token });
      assert.ok(second.r.ok);
      assert.equal((await srv.api(second.j, '/api/setup', setupBody)).status, 200);
    } finally {
      await srv.close();
    }
  });
});

describe('configuration', () => {
  test('FI-12 a bad LIMIT_FAMILIES or SIGNUP_CONTACT_URL stops the server at startup', async () => {
    const dir = tmpDir('fi-config');
    const base = {
      PORT: '0',
      DATABASE_PATH: path.join(dir, 'refused.db'),
      APP_BASE_URL: 'https://little.example.test',
      SESSION_SECRET: SECRET,
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
    };
    try {
      for (const [env, words] of [
        [{ LIMIT_FAMILIES: '0' }, /LIMIT_FAMILIES must be a whole number/],
        [{ LIMIT_FAMILIES: 'ten' }, /LIMIT_FAMILIES must be a whole number/],
        [{ SIGNUP_CONTACT_URL: 'http://example.test/ask' }, /SIGNUP_CONTACT_URL must be/],
        [{ SIGNUP_CONTACT_URL: 'javascript:alert(1)' }, /SIGNUP_CONTACT_URL must be/],
      ]) {
        const r = await startFails({ ...base, ...env });
        assert.equal(r.code, 1);
        assert.match(r.out, words);
      }
    } finally {
      removeDir(dir);
    }
  });
});
