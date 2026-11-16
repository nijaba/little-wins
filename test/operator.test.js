// The operator page: counts and health for whoever runs the installation, never family content.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { jar, startServer, startFails, tmpDir, removeDir, ROOT } = require('./helpers');

const OP = { sub: 'op-1', email: 'op@example.test', name: 'Olive Operator' };
const OWNER = { sub: 'own-1', email: 'owner@example.test', name: 'Opal Owner' };
const OWNER2 = { sub: 'own-2', email: 'owner2@example.test', name: 'Orion Owner' };

/** A closed instance: two named parents may create families, and one operator may only look. */
const closed = (extra = {}) =>
  startServer({
    allowlist: 'google:owner@example.test,google:owner2@example.test',
    env: { OPERATOR_ALLOWLIST: 'google:op@example.test', ...extra },
  });

async function signedIn(srv, provider, who) {
  const j = jar();
  const r = await srv.signIn(j, provider, who);
  assert.ok(r.ok, `sign-in ${r.status} ${r.body}`);
  return j;
}

test('a non-parent operator signs in to a closed instance and sees only the operator state', async () => {
  const srv = await closed();
  try {
    const j = await signedIn(srv, 'google', OP);
    const S = await srv.api(j, '/api/state');
    assert.equal(S.status, 200);
    assert.equal(S.json.setup, true);
    assert.equal(S.json.canCreate, false);
    assert.equal(S.json.operator, true);
    assert.equal(S.json.role, 'parent');
    // They cannot create a family, and no other family route is open to them.
    const setup = await srv.api(j, '/api/setup', {
      family_name: 'Sneaky',
      child_name: 'Kid',
      timezone: 'UTC',
    });
    assert.equal(setup.status, 403);
    assert.equal(
      srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM families').get().n),
      0,
    );
    for (const route of [
      '/api/add',
      '/api/item/save',
      '/api/child/save',
      '/api/family/delete',
      '/api/pairing/create',
    ])
      assert.equal(
        (await srv.api(j, route, { confirm: '', name: 'x', kind: 'target' })).status,
        403,
        route,
      );
    assert.equal((await srv.api(j, '/api/export')).status, 403, 'no family to export');
    assert.equal((await srv.api(j, '/api/operator')).status, 200);
  } finally {
    await srv.close();
  }
});

test('operator sign-in matches on account, not display name; strangers are still refused', async () => {
  const srv = await closed();
  try {
    const stranger = jar();
    const r = await srv.signIn(stranger, 'google', {
      sub: 'x-1',
      email: 'nobody@example.test',
      name: 'op@example.test',
    });
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
    const near = await srv.signIn(jar(), 'google', {
      sub: 'x-2',
      email: 'op@example.test.evil',
      name: 'Olive Operator',
    });
    assert.equal(near.ok, false);
    const gh = await srv.signIn(jar(), 'github', {
      sub: '77',
      login: 'op',
      name: 'op@example.test',
    });
    assert.equal(gh.ok, false, 'a GitHub account is not the Google account of the same name');
  } finally {
    await srv.close();
  }
});

test('operators can be listed by GitHub login or Google Workspace domain', async () => {
  const srv = await closed({ OPERATOR_ALLOWLIST: 'github:ops-dev,google-domain:ops.example.test' });
  try {
    const gh = await signedIn(srv, 'github', { sub: '4242', login: 'Ops-Dev', name: 'GH Ops' });
    assert.equal((await srv.api(gh, '/api/state')).json.operator, true);
    assert.equal((await srv.api(gh, '/api/operator')).status, 200);
    const ws = await signedIn(srv, 'google', {
      sub: 'w-1',
      email: 'any@ops.example.test',
      hd: 'ops.example.test',
      name: 'WS',
    });
    assert.equal((await srv.api(ws, '/api/operator')).status, 200);
    const other = await srv.signIn(jar(), 'google', {
      sub: 'w-2',
      email: 'any@other.example.test',
      hd: 'other.example.test',
      name: 'WS',
    });
    assert.equal(other.ok, false);
  } finally {
    await srv.close();
  }
});

test('/api/operator returns counts and health, and no names or emails', async () => {
  const srv = await closed();
  try {
    const A = await srv.newFamily({ name: 'Walnut Family', child: 'Hazel Kid', who: OWNER });
    const B = await srv.newFamily({ name: 'Maple Family', child: 'Cedar Kid', who: OWNER2 });
    await srv.api(B.jar, '/api/child/save', { name: 'Birch Sibling' });
    await srv.pairChild(A.jar, A.childId);
    const S = (await srv.api(A.jar, '/api/state')).json;
    const target = S.items.find((i) => i.kind === 'target');
    await srv.api(A.jar, '/api/add', { child_id: A.childId, item_id: target.id });
    await srv.api(A.jar, '/api/add', { child_id: A.childId, item_id: target.id });
    const op = await signedIn(srv, 'google', OP);

    const r = await srv.api(op, '/api/operator');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    const count = (sql) => srv.sql((db) => db.prepare(sql).get().n);
    assert.equal(r.json.families, 2);
    assert.equal(r.json.parents, 2);
    assert.equal(r.json.children, 3);
    assert.equal(r.json.entries, 2);
    assert.equal(r.json.devices, count('SELECT COUNT(*) n FROM sessions'));
    assert.equal(r.json.devices, 4, 'two owners, one child device and the operator');
    assert.equal(r.json.activeDevices30d, 4);
    assert.ok(Number.isInteger(r.json.dbBytes) && r.json.dbBytes > 0);
    assert.equal(r.json.version, require(path.join(ROOT, 'package.json')).version);
    assert.ok(Number.isInteger(r.json.uptimeSeconds) && r.json.uptimeSeconds >= 0);
    for (const key of [
      'families',
      'parents',
      'children',
      'devices',
      'activeDevices30d',
      'entries',
      'dbBytes',
      'version',
      'uptimeSeconds',
    ])
      assert.ok(key in r.json, key);

    // Devices unused for a month are not "active".
    srv.sql((db) =>
      db
        .prepare('UPDATE sessions SET last_seen=? WHERE id=(SELECT MIN(id) FROM sessions)')
        .run(new Date(Date.now() - 45 * 864e5).toISOString()),
    );
    const later = (await srv.api(op, '/api/operator')).json;
    assert.equal(later.activeDevices30d, 3);
    assert.equal(later.devices, 4);

    // Never family content: no family, child, parent or account name or email anywhere.
    for (const secret of [
      'Walnut',
      'Maple',
      'Hazel',
      'Cedar',
      'Birch',
      'Opal',
      'Orion',
      'Olive',
      'example.test',
      '@',
      OWNER.sub,
      OWNER2.sub,
    ])
      assert.ok(!r.text.includes(secret), `the operator page must not contain "${secret}"`);
    for (const value of Object.values(r.json)) assert.equal(typeof value === 'object', false);
  } finally {
    await srv.close();
  }
});

test('/api/operator: a normal parent, a child device and a visitor are refused', async () => {
  const srv = await closed();
  try {
    const A = await srv.newFamily({ name: 'Walnut Family', who: OWNER });
    const kid = await srv.pairChild(A.jar, A.childId);
    const parent = await srv.api(A.jar, '/api/operator');
    assert.equal(parent.status, 403);
    assert.deepEqual(parent.json, { error: 'Only operators can see this' });
    assert.equal((await srv.api(kid.jar, '/api/operator')).status, 403);
    assert.equal((await srv.api(null, '/api/operator')).status, 401);
    const state = (await srv.api(A.jar, '/api/state')).json;
    assert.ok(!('operator' in state), 'no operator flag for a normal parent');
    assert.ok(!('operator' in (await srv.api(kid.jar, '/api/state')).json));
    // A family parent whose account is not listed stays a normal parent, with or without a setup.
    const nobody = jar();
    assert.equal(
      (await srv.signIn(nobody, 'google', { sub: 'z', email: 'z@example.test', name: 'Z' })).ok,
      false,
    );
  } finally {
    await srv.close();
  }
});

test('a parent who is also an operator keeps their family and gains the operator page', async () => {
  const srv = await closed({ OPERATOR_ALLOWLIST: 'google:owner@example.test' });
  try {
    const A = await srv.newFamily({ name: 'Walnut Family', who: OWNER });
    const S = (await srv.api(A.jar, '/api/state')).json;
    assert.equal(S.operator, true);
    assert.equal(S.family.name, 'Walnut Family');
    assert.equal(S.me.owner, true);
    assert.equal((await srv.api(A.jar, '/api/operator')).status, 200);
    const add = await srv.api(A.jar, '/api/child/save', { name: 'Second' });
    assert.equal(add.status, 200);
    assert.equal(add.json.operator, true, 'every state reply carries the flag');
    // Their child device is not an operator.
    const kid = await srv.pairChild(A.jar, A.childId);
    assert.equal((await srv.api(kid.jar, '/api/operator')).status, 403);
    assert.ok(!('operator' in (await srv.api(kid.jar, '/api/state')).json));
    // Another parent of the same family is not.
    const B = await srv.newFamily({ name: 'Maple Family', who: OWNER2 });
    assert.equal((await srv.api(B.jar, '/api/operator')).status, 403);
  } finally {
    await srv.close();
  }
});

test('an operator in open or invite mode who has no family sees the operator flag next to setup', async () => {
  const srv = await startServer({
    signup: 'open',
    env: { OPERATOR_ALLOWLIST: 'google:op@example.test' },
  });
  try {
    const j = await signedIn(srv, 'google', OP);
    const S = (await srv.api(j, '/api/state')).json;
    assert.deepEqual([S.setup, S.canCreate, S.operator], [true, true, true]);
    assert.equal((await srv.api(j, '/api/operator')).status, 200);
  } finally {
    await srv.close();
  }
});

test('/api/setup tells an operator so, and not an ordinary parent', async () => {
  const srv = await startServer({
    signup: 'open',
    env: { OPERATOR_ALLOWLIST: 'google:op@example.test' },
  });
  try {
    const body = { family_name: 'Walnut Family', child_name: 'Hazel', timezone: 'UTC' };
    const op = await signedIn(srv, 'google', OP);
    const made = await srv.api(op, '/api/setup', body);
    assert.equal(made.status, 200);
    assert.equal(made.json.operator, true);
    assert.equal((await srv.api(op, '/api/state')).json.operator, true, 'and so does state');
    const plain = await srv.newFamily();
    assert.ok(!('operator' in plain.state), 'an ordinary parent gets no flag');
  } finally {
    await srv.close();
  }
  const closedSrv = await startServer({
    allowlist: 'google:op@example.test',
    env: { OPERATOR_ALLOWLIST: 'google:op@example.test' },
  });
  try {
    const op = await signedIn(closedSrv, 'google', OP);
    const made = await closedSrv.api(op, '/api/setup', {
      family_name: 'Walnut Family',
      child_name: 'Hazel',
      timezone: 'UTC',
    });
    assert.equal(made.status, 200);
    assert.equal(made.json.operator, true, 'an operator who is also on PARENT_ALLOWLIST');
  } finally {
    await closedSrv.close();
  }
});

test('an unreadable OPERATOR_ALLOWLIST entry refuses to start', async () => {
  const dir = tmpDir('operator');
  const r = await startFails({
    PORT: '0',
    DATABASE_PATH: path.join(dir, 'x.db'),
    APP_BASE_URL: 'http://localhost:3999',
    LITTLE_WINS_FAKE_SSO: '1',
    OPERATOR_ALLOWLIST: 'google:ok@example.test,nonsense',
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /OPERATOR_ALLOWLIST has an entry it can't read: "nonsense"/);
  removeDir(dir);
});
