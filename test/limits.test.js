// Per-family limits (config.limits), set here with LIMIT_* variables so each is quick to reach.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const {
  ROOT,
  coverageEnv,
  jar,
  startServer,
  startFails,
  tmpDir,
  removeDir,
  item,
} = require('./helpers');

const LIMIT_MESSAGE = /has reached its limit for/;

/** Runs a check on a dedicated server, whatever happens. */
async function withServer(opts, fn) {
  const srv = await startServer({ allowlist: '*', ...opts });
  try {
    await fn(srv);
  } finally {
    await srv.close();
  }
}

test('LM-01 children: the next add is 409, renaming still works, deleting frees a place', async () => {
  await withServer({ env: { LIMIT_CHILDREN: '2' } }, async (srv) => {
    const f = await srv.newFamily({ child: 'One' });
    const post = (p, b) => srv.api(f.jar, p, b);
    const second = await post('/api/child/save', { name: 'Two' });
    assert.equal(second.status, 200);
    const third = await post('/api/child/save', { name: 'Three' });
    assert.equal(third.status, 409);
    assert.match(third.json.error, LIMIT_MESSAGE);
    assert.match(third.json.error, /children/);
    assert.equal(
      srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM children').get().n),
      2,
    );
    const rename = await post('/api/child/save', { id: f.childId, name: 'Renamed' });
    assert.equal(rename.status, 200, 'editing an existing child works at the limit');
    assert.equal(rename.json.children[0].name, 'Renamed');
    assert.equal((await post('/api/child/delete', { id: second.json.childId })).status, 200);
    assert.equal((await post('/api/child/save', { name: 'Three' })).status, 200);
  });
});

test('LM-02 items: the next add is 409, editing, moving and deleting still work', async () => {
  await withServer({ env: { LIMIT_ITEMS: '2' } }, async (srv) => {
    const f = await srv.newFamily({ starter: false });
    const post = (p, b) => srv.api(f.jar, p, b);
    let S = (await post('/api/item/save', { kind: 'target', name: 'A', pmin: 1, pmax: 2 })).json;
    S = (await post('/api/item/save', { kind: 'penalty', name: 'B', pmin: 1 })).json;
    const full = await post('/api/item/save', { kind: 'challenge', name: 'C' });
    assert.equal(full.status, 409);
    assert.match(full.json.error, LIMIT_MESSAGE);
    assert.match(full.json.error, /behaviors, penalties and challenges/);
    const a = item(S, 'target', 'A');
    const edit = await post('/api/item/save', {
      id: a.id,
      kind: 'target',
      name: 'A2',
      pmin: 1,
      pmax: 3,
    });
    assert.equal(edit.status, 200, 'editing an existing item works at the limit');
    assert.ok(item(edit.json, 'target', 'A2'));
    assert.equal((await post('/api/item/move', { id: a.id, dir: 1 })).status, 200);
    assert.equal((await post('/api/item/delete', { id: a.id })).status, 200);
    assert.equal(
      (await post('/api/item/save', { kind: 'challenge', name: 'C' })).status,
      200,
      'a deleted (inactive) item no longer counts',
    );
    assert.equal((await post('/api/item/save', { kind: 'challenge', name: 'D' })).status, 409);
  });
});

test('LM-03 rewards: the next add is 409, editing still works', async () => {
  await withServer({ env: { LIMIT_REWARDS: '1' } }, async (srv) => {
    const f = await srv.newFamily({ starter: false });
    const post = (p, b) => srv.api(f.jar, p, b);
    const first = await post('/api/reward/save', { name: 'Movie', stars: 1, points: 10 });
    assert.equal(first.status, 200);
    const second = await post('/api/reward/save', { name: 'Zoo', stars: 1, points: 10 });
    assert.equal(second.status, 409);
    assert.match(second.json.error, LIMIT_MESSAGE);
    assert.match(second.json.error, /rewards/);
    const id = first.json.rewards[0].id;
    const edit = await post('/api/reward/save', { id, name: 'Cinema', stars: 2, points: 20 });
    assert.equal(edit.status, 200);
    assert.equal(edit.json.rewards[0].name, 'Cinema');
    assert.equal((await post('/api/reward/delete', { id })).status, 200);
    assert.equal(
      (await post('/api/reward/save', { name: 'Zoo', stars: 1, points: 10 })).status,
      200,
    );
  });
});

test('LM-04 parents: a full family cannot be joined by invite, and the invite stays unused', async () => {
  for (const signup of [undefined, 'open']) {
    await withServer(
      { signup, allowlist: 'google:owner@example.test', env: { LIMIT_PARENTS: '1' } },
      async (srv) => {
        const f = await srv.newFamily({
          who: { sub: 'owner-1', email: 'owner@example.test', name: 'Owner' },
        });
        const inv = await srv.api(f.jar, '/api/invite/create', {});
        assert.equal(inv.status, 200, 'an invite can be made');
        const token = inv.json.issued.link.split('#invite=')[1];

        const guest = jar();
        const r = await srv.signIn(
          guest,
          'google',
          { sub: 'guest-1', email: 'guest@example.test', name: 'Guest' },
          { invite: token },
        );
        if (signup === 'open') {
          // Open sign-up: the guest signs in but is not in A's family; they may set up their own.
          assert.ok(r.ok);
          const S = (await srv.api(guest, '/api/state')).json;
          assert.equal(S.setup, true, 'no family: setup, not the full family');
          assert.notEqual(S.family?.name, 'Test Family');
        } else {
          assert.equal(r.ok, false, 'closed: the guest is refused');
          assert.equal(r.status, 403);
        }
        const S = (await srv.api(f.jar, '/api/state')).json;
        assert.equal(S.parents.length, 1, 'still one parent');
        assert.equal(S.invites.length, 1, 'the invite is still listed');
        assert.equal(
          srv.sql((db) => db.prepare('SELECT used_at FROM invites').get().used_at ?? null),
          null,
          'the invite stays unused',
        );
        // Raising nothing: the owner can still revoke it, and no membership appeared.
        assert.equal(
          srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM memberships').get().n),
          1,
        );
      },
    );
  }
});

test('LM-05 parents: below the limit an invite still works', async () => {
  await withServer(
    { allowlist: 'google:parent1@example.test', env: { LIMIT_PARENTS: '2' } },
    async (srv) => {
      const f = await srv.newFamily({
        who: { sub: 'owner-2', email: 'parent1@example.test', name: 'Owner' },
      });
      const inv = await srv.api(f.jar, '/api/invite/create', {});
      const guest = jar();
      const r = await srv.signIn(guest, 'google', 'bob', {
        invite: inv.json.issued.link.split('#invite=')[1],
      });
      assert.ok(r.ok);
      assert.equal((await srv.api(f.jar, '/api/state')).json.parents.length, 2);
      // Now full: a second invite cannot be used.
      const inv2 = await srv.api(f.jar, '/api/invite/create', {});
      const third = await srv.signIn(jar(), 'github', 'carol', {
        invite: inv2.json.issued.link.split('#invite=')[1],
      });
      assert.equal(third.ok, false);
      assert.equal((await srv.api(f.jar, '/api/state')).json.parents.length, 2);
    },
  );
});

test('LM-06 devices: pairing and redeeming stop at the limit; revoking a device frees a place', async () => {
  await withServer({ env: { LIMIT_DEVICES: '2' } }, async (srv) => {
    const f = await srv.newFamily(); // the parent's own session is one device
    const post = (p, b) => srv.api(f.jar, p, b);
    const c1 = await post('/api/pairing/create', { child_id: f.childId });
    const c2 = await post('/api/pairing/create', { child_id: f.childId });
    assert.equal(c1.status, 200);
    assert.equal(c2.status, 200, 'codes can be made while a place is free');

    const kid1 = jar();
    assert.equal((await srv.api(kid1, '/api/pair', { code: c1.json.issued.code })).status, 200);
    const kid2 = jar();
    const refused = await srv.api(kid2, '/api/pair', { code: c2.json.issued.code });
    assert.equal(refused.status, 409);
    assert.match(refused.json.error, LIMIT_MESSAGE);
    assert.match(refused.json.error, /devices/);
    assert.equal(kid2.header, '', 'no session cookie');
    assert.equal(
      srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM sessions').get().n),
      2,
    );

    const more = await post('/api/pairing/create', { child_id: f.childId });
    assert.equal(more.status, 409, 'pairing/create is refused too');
    assert.match(more.json.error, LIMIT_MESSAGE);

    const state = (await srv.api(f.jar, '/api/state')).json;
    const device = state.devices.find((d) => d.kind === 'child');
    assert.equal((await post('/api/session/revoke', { id: device.id })).status, 200);
    assert.equal((await post('/api/pairing/create', { child_id: f.childId })).status, 200);
  });
});

// A code refused because the family is at its device limit is not used up.
test('LM-07 devices: a code refused for the limit is still good once a place is free', async () => {
  await withServer({ env: { LIMIT_DEVICES: '2' } }, async (srv) => {
    const f = await srv.newFamily();
    const code = async () =>
      (await srv.api(f.jar, '/api/pairing/create', { child_id: f.childId })).json.issued.code;
    const [c1, c2] = [await code(), await code()];
    assert.equal((await srv.api(jar(), '/api/pair', { code: c1 })).status, 200);
    assert.equal((await srv.api(jar(), '/api/pair', { code: c2 })).status, 409);
    const state = (await srv.api(f.jar, '/api/state')).json;
    const device = state.devices.find((d) => d.kind === 'child');
    await srv.api(f.jar, '/api/session/revoke', { id: device.id });
    const retry = await srv.api(jar(), '/api/pair', { code: c2 });
    assert.equal(retry.status, 200, 'SERVER BUG: the code was burned by the refused attempt');
  });
});

test('LM-08 entries per day: add, warn and mark stop at the limit; edits and reads still work', async () => {
  await withServer({ env: { LIMIT_ENTRIES_PER_DAY: '3' } }, async (srv) => {
    const f = await srv.newFamily();
    const post = (p, b) => srv.api(f.jar, p, b);
    const S0 = (await srv.api(f.jar, '/api/state')).json;
    const target = item(S0, 'target');
    const challenge = item(S0, 'challenge');
    const kid = f.childId;

    assert.equal((await post('/api/add', { child_id: kid, item_id: target.id })).status, 200);
    assert.equal((await post('/api/warn', { child_id: kid, item_id: target.id })).status, 200);
    assert.equal(
      (await post('/api/mark', { child_id: kid, item_id: challenge.id, mark: 'ok' })).status,
      200,
    );
    for (const [route, body] of [
      ['/api/add', { child_id: kid, item_id: target.id }],
      ['/api/warn', { child_id: kid, item_id: target.id }],
      ['/api/mark', { child_id: kid, item_id: challenge.id, mark: 'perfect' }],
    ]) {
      const r = await post(route, body);
      assert.equal(r.status, 409, route);
      assert.match(r.json.error, LIMIT_MESSAGE);
      assert.match(r.json.error, /entries today/);
    }
    assert.equal(
      srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM entries').get().n),
      3,
    );

    const S = (await srv.api(f.jar, '/api/state')).json;
    const entry = S.hist.find((h) => h.kind === 'points');
    assert.equal((await post('/api/undo', { id: entry.id })).status, 200, 'undo is not an add');
    assert.equal(
      (await post('/api/add', { child_id: kid, item_id: target.id })).status,
      409,
      'an undone entry still counts for the day',
    );
    assert.equal(
      (
        await post('/api/item/save', {
          id: target.id,
          kind: 'target',
          name: 'Renamed',
          pmin: 1,
          pmax: 2,
        })
      ).status,
      200,
    );
    assert.equal((await srv.api(f.jar, '/api/state')).status, 200, 'reads still work');
  });
});

test('LM-09 the limit is per family: another family has its own budget', async () => {
  await withServer({ signup: 'open', env: { LIMIT_CHILDREN: '2' } }, async (srv) => {
    const a = await srv.newFamily();
    const b = await srv.newFamily();
    assert.equal((await srv.api(a.jar, '/api/child/save', { name: 'X' })).status, 200);
    assert.equal((await srv.api(a.jar, '/api/child/save', { name: 'Y' })).status, 409);
    assert.equal((await srv.api(b.jar, '/api/child/save', { name: 'X' })).status, 200);
  });
});

// --- Defaults and validation ---------------------------------------------------------------
/** config.limits as the server would read them, from a child process. */
function limitsFor(env) {
  const r = spawnSync(
    process.execPath,
    ['-e', "console.log(JSON.stringify(require('./server/config').limits))"],
    {
      cwd: ROOT,
      env: {
        PATH: process.env.PATH,
        ...coverageEnv(),
        APP_BASE_URL: 'http://localhost:3999',
        ...env,
      },
      encoding: 'utf8',
    },
  );
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('LM-10 limits default to generous numbers when closed, tighter ones when sign-up is open or invite', () => {
  const closed = limitsFor({});
  const open = limitsFor({ SIGNUP_MODE: 'open' });
  const invite = limitsFor({ SIGNUP_MODE: 'invite' });
  assert.deepEqual(Object.keys(open).sort(), Object.keys(closed).sort());
  assert.deepEqual(Object.keys(closed).sort(), [
    'children',
    'devices',
    'entriesPerDay',
    'items',
    'parents',
    'rewards',
  ]);
  for (const key of Object.keys(closed)) {
    assert.ok(Number.isInteger(closed[key]) && closed[key] > 0, key);
    assert.ok(open[key] < closed[key], `open sign-up is tighter for ${key}`);
  }
  assert.deepEqual(invite, open, 'invite sign-up is hosted too, so it gets the hosted defaults');
});

test('LM-11 LIMIT_* variables override the defaults one at a time', () => {
  const base = limitsFor({ SIGNUP_MODE: 'open' });
  const over = limitsFor({ SIGNUP_MODE: 'open', LIMIT_CHILDREN: '3', LIMIT_ENTRIES_PER_DAY: '77' });
  assert.equal(over.children, 3);
  assert.equal(over.entriesPerDay, 77);
  assert.equal(over.items, base.items);
  assert.equal(over.devices, base.devices);
});

test('LM-12 open sign-up applies the hosted defaults to a real family', async () => {
  const hosted = limitsFor({ SIGNUP_MODE: 'open' });
  await withServer({ signup: 'open' }, async (srv) => {
    const f = await srv.newFamily({ starter: false });
    let last;
    for (let i = 1; i < hosted.children; i++) {
      last = await srv.api(f.jar, '/api/child/save', { name: `Kid ${i}` });
      assert.equal(last.status, 200, `child ${i + 1}`);
    }
    const over = await srv.api(f.jar, '/api/child/save', { name: 'One too many' });
    assert.equal(over.status, 409);
    assert.match(over.json.error, LIMIT_MESSAGE);
  });
});

test('SV-07 a bad LIMIT_* value refuses to start', async () => {
  const dir = tmpDir('limits');
  const base = {
    PORT: '0',
    DATABASE_PATH: path.join(dir, 'x.db'),
    APP_BASE_URL: 'http://localhost:3999',
    LITTLE_WINS_FAKE_SSO: '1',
  };
  for (const [name, value] of [
    ['LIMIT_CHILDREN', '0'],
    ['LIMIT_ITEMS', '-5'],
    ['LIMIT_PARENTS', 'many'],
    ['LIMIT_REWARDS', '2.5'],
    ['LIMIT_DEVICES', '1e1x'],
    ['LIMIT_ENTRIES_PER_DAY', '0'],
  ]) {
    const r = await startFails({ ...base, [name]: value });
    assert.equal(r.code, 1, `${name}=${value}`);
    assert.match(r.out, new RegExp(`${name} must be a whole number of at least 1`));
  }
  removeDir(dir);
});
