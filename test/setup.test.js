// Family setup after the first sign-in, and what a session can do before it is done.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, jar, parentRouteList, SESSION } = require('./helpers');
const { starterCounts } = require('../server/db');

let srv;
before(async () => {
  srv = await startServer({ signup: 'open' });
});
after(() => srv.close());

const kinds = (S) => {
  const n = { target: 0, penalty: 0, challenge: 0 };
  for (const i of S.items) n[i.kind]++;
  return n;
};

async function pendingParent(who) {
  const j = jar();
  const r = await srv.signIn(j, 'google', who);
  assert.ok(r.ok, r.body);
  return j;
}

test('SU-02 a signed-in parent without a family sees the setup state', async () => {
  const j = await pendingParent({ sub: 'p-setup', email: 'p@example.test', name: 'Pending' });
  const S = (await srv.api(j, '/api/state')).json;
  assert.equal(S.setup, true);
  assert.equal(S.role, 'parent');
  assert.equal(S.me.name, 'Pending');
  assert.equal(S.items, undefined, 'no family data');
});

test('SU-03 setup needs a family name, a child name and a known time zone', async () => {
  const j = await pendingParent({ sub: 'p-bad', email: 'bad@example.test', name: 'Bad' });
  const ok = { family_name: 'F', child_name: 'C', timezone: 'UTC' };
  for (const [name, body, status] of [
    ['no family name', { ...ok, family_name: '' }, 400],
    ['blank family name', { ...ok, family_name: '   ' }, 400],
    ['no child name', { ...ok, child_name: undefined }, 400],
    ['unknown time zone', { ...ok, timezone: 'Mars/Base' }, 400],
    ['no time zone', { ...ok, timezone: undefined }, 400],
    ['time zone that is not text', { ...ok, timezone: 5 }, 400],
    ['a very long time zone name', { ...ok, timezone: 'A'.repeat(100) }, 400],
  ])
    assert.equal((await srv.api(j, '/api/setup', body)).status, status, name);
  assert.equal((await srv.api(j, '/api/state')).json.setup, true, 'still not set up');
});

test('SU-04 setup with the starter list creates it, and the first child', async () => {
  const f = await srv.newFamily({ name: '  Starter  ', child: 'Kid', tz: 'America/Chicago' });
  const S = f.state;
  assert.deepEqual(kinds(S), {
    target: starterCounts.targets,
    penalty: starterCounts.penalties,
    challenge: starterCounts.challenges,
  });
  assert.equal(S.rewards.length, starterCounts.rewards);
  assert.deepEqual(S.family, { name: 'Starter', timezone: 'America/Chicago', weekStart: 1 });
  assert.deepEqual(
    S.children.map((c) => c.name),
    ['Kid'],
  );
  assert.equal(S.childName, 'Kid');
  assert.equal(S.me.owner, true);
  assert.deepEqual(
    S.parents.map((p) => [p.role, p.me]),
    [['owner', true]],
  );
});

test('SU-05 starter: false creates an empty family', async () => {
  const f = await srv.newFamily({ starter: false });
  assert.deepEqual(kinds(f.state), { target: 0, penalty: 0, challenge: 0 });
  assert.equal(f.state.rewards.length, 0);
});

test('SU-06 names are trimmed and capped, and week_start 0 means Sunday', async () => {
  const f = await srv.newFamily({
    name: 'F'.repeat(100),
    child: `  ${'C'.repeat(60)}  `,
    weekStart: 0,
  });
  assert.equal(f.state.family.name.length, 60);
  assert.equal(f.state.childName.length, 40);
  assert.equal(f.state.family.weekStart, 0);
});

test('SU-07 a parent can only set up once', async () => {
  const f = await srv.newFamily({ name: 'Once' });
  const r = await srv.api(f.jar, '/api/setup', {
    family_name: 'Twice',
    child_name: 'X',
    timezone: 'UTC',
  });
  assert.equal(r.status, 409);
  assert.equal((await srv.api(f.jar, '/api/state')).json.family.name, 'Once');
});

test('SU-08 a session still setting up can only do setup, state and logout', async () => {
  const j = await pendingParent({ sub: 'p-limits', email: 'lim@example.test', name: 'Lim' });
  for (const route of [...parentRouteList(), '/api/nope']) {
    const r = await srv.api(j, route, {
      child_id: 1,
      item_id: 1,
      id: 1,
      name: 'x',
      kind: 'target',
    });
    assert.equal(r.status, 403, route);
  }
  assert.equal((await srv.api(j, '/api/state')).json.setup, true);
  const out = await srv.api(j, '/api/logout', {});
  assert.equal(out.status, 200);
  assert.equal((await srv.api(j, '/api/state')).status, 401);
  assert.equal(j.c[SESSION], undefined);
});

test('SU-09 setup and state need a session', async () => {
  assert.equal(
    (await srv.api(null, '/api/setup', { family_name: 'F', child_name: 'C', timezone: 'UTC' }))
      .status,
    401,
  );
  assert.equal((await srv.api(null, '/api/state')).status, 401);
  assert.equal((await srv.api(null, '/api/logout', {})).status, 401);
});

test('SU-10 a child device cannot run setup', async () => {
  const f = await srv.newFamily();
  const dev = await srv.pairChild(f.jar, f.childId);
  const r = await srv.api(dev.jar, '/api/setup', {
    family_name: 'F',
    child_name: 'C',
    timezone: 'UTC',
  });
  assert.equal(r.status, 403);
});
