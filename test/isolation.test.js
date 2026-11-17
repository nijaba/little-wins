// Cross-family isolation. Family B's parent calls EVERY parent route with IDs that belong to
// family A. Each must act as if the ID does not exist (404), or have no effect where the route
// returns state anyway, and A's data must stay byte-for-byte the same. The route list is read
// from server/routes.js, so a new route without a case here fails the suite.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { jar, startServer, parentRouteList, item } = require('./helpers');

const SECRET_WORD = 'Zorblax';
let srv;
let A;
let B;
let A2; // a co-parent of A
let ids; // A's IDs
let fidA;
let kidDevA;
let kidDevB;
let bItems;

const TABLES = [
  'items',
  'rewards',
  'entries',
  'children',
  'invites',
  'pairings',
  'memberships',
  'sessions',
];

/** Everything stored for a family, as one string. */
const dump = (fid) =>
  srv.sql((db) =>
    JSON.stringify([
      db.prepare('SELECT * FROM families WHERE id=?').all(fid),
      ...TABLES.map((t) =>
        db.prepare(`SELECT * FROM ${t} WHERE family_id=? ORDER BY rowid`).all(fid),
      ),
      db
        .prepare(
          'SELECT * FROM users WHERE id IN (SELECT user_id FROM memberships WHERE family_id=?) ORDER BY id',
        )
        .all(fid),
    ]),
  );
/** A's view through its own sessions, for every child. */
async function aView() {
  const views = [];
  for (const c of [ids.child, ids.child2]) {
    views.push((await srv.api(A.jar, `/api/state?child=${c}`)).json);
    views.push((await srv.api(kidDevA.jar, `/api/state?child=${c}`)).json);
  }
  return JSON.stringify(views);
}

before(async () => {
  srv = await startServer({ signup: 'open' });
  A = await srv.newFamily({ name: `${SECRET_WORD} Family`, child: `${SECRET_WORD} Kid` });
  const post = (p, b) => srv.api(A.jar, p, b);
  let S = (await post('/api/child/save', { name: `${SECRET_WORD} Sibling` })).json;
  const child2 = S.childId;
  S = (
    await post('/api/item/save', { kind: 'target', name: `${SECRET_WORD} Chore`, pmin: 5, pmax: 9 })
  ).json;
  S = (await post('/api/item/save', { kind: 'challenge', name: `${SECRET_WORD} Challenge` })).json;
  S = (await post('/api/item/save', { kind: 'penalty', name: `${SECRET_WORD} Oops`, pmin: 3 }))
    .json;
  S = (await post('/api/reward/save', { name: `${SECRET_WORD} Prize`, stars: 1, points: 10 })).json;
  const target = item(S, 'target', SECRET_WORD);
  const challenge = item(S, 'challenge', SECRET_WORD);
  const penalty = item(S, 'penalty', SECRET_WORD);
  const reward = S.rewards.find((r) => r.name.startsWith(SECRET_WORD));
  for (const child of [A.childId, child2]) {
    await post('/api/add', { child_id: child, item_id: target.id });
    await post('/api/warn', { child_id: child, item_id: target.id });
    await post('/api/mark', { child_id: child, item_id: challenge.id, mark: 'perfect' });
  }
  S = (await post('/api/add', { child_id: A.childId, item_id: target.id })).json;
  const entry = S.hist.find((h) => h.kind === 'points').id;
  const inv = await post('/api/invite/create', {});
  const invite = inv.json.invites.at(-1).id;
  A2 = jar();
  assert.ok(
    (await srv.signIn(A2, 'google', 'bob', { invite: inv.json.issued.link.split('#invite=')[1] }))
      .ok,
  );
  kidDevA = await srv.pairChild(A.jar, A.childId);
  await srv.api(A.jar, '/api/pairing/create', { child_id: child2 }); // an unused code
  await post('/api/invite/create', {}); // and an unused second invite
  S = (await srv.api(A.jar, '/api/state')).json;
  ids = {
    child: A.childId,
    child2,
    target: target.id,
    challenge: challenge.id,
    penalty: penalty.id,
    reward: reward.id,
    entry,
    invite,
    owner: S.me.userId,
    coparent: S.parents.find((p) => !p.me).id,
    childSession: S.devices.find((d) => d.kind === 'child').id,
    parentSession: S.devices.find((d) => d.me).id,
    coparentSession: S.devices.find((d) => d.kind === 'parent' && !d.me).id,
  };
  fidA = srv.sql(
    (db) => db.prepare('SELECT id FROM families WHERE name=?').get(`${SECRET_WORD} Family`).id,
  );

  B = await srv.newFamily({ name: 'Plain Family', child: 'Plain Kid' });
  kidDevB = await srv.pairChild(B.jar, B.childId);
  bItems = {
    target: item(B.state, 'target').id,
    challenge: item(B.state, 'challenge').id,
    reward: B.state.rewards[0].id,
  };
});
after(() => srv.close());

/** One entry per parent route: the calls B makes, with A's IDs, and the status expected. */
const cases = () => {
  const byB = (extra) => ({ child_id: B.childId, ...extra });
  return {
    '/api/item/save': [
      [{ id: ids.target, kind: 'target', name: 'Hacked', pmin: 1, pmax: 1 }, 404],
      [{ id: ids.challenge, kind: 'challenge', name: 'Hacked' }, 404],
      [{ id: ids.penalty, kind: 'penalty', name: 'Hacked', pmin: 1 }, 404],
    ],
    '/api/item/move': [
      [{ id: ids.target, dir: -1 }, 200],
      [{ id: ids.target, dir: 1 }, 200],
      [{ id: ids.challenge, dir: -1 }, 200],
    ],
    '/api/item/delete': [
      [{ id: ids.target }, 404],
      [{ id: ids.penalty }, 404],
    ],
    '/api/reward/save': [[{ id: ids.reward, name: 'Hacked', stars: 1, points: 1 }, 404]],
    '/api/reward/move': [
      [{ id: ids.reward, dir: -1 }, 200],
      [{ id: ids.reward, dir: 1 }, 200],
    ],
    '/api/reward/delete': [[{ id: ids.reward }, 404]],
    '/api/add': [
      [{ child_id: ids.child, item_id: ids.target }, 404],
      [{ child_id: ids.child, item_id: bItems.target }, 404],
      [byB({ item_id: ids.target }), 404],
      [{ child_id: ids.child, item_id: ids.penalty, points: 99 }, 404],
    ],
    '/api/warn': [
      [{ child_id: ids.child, item_id: ids.target }, 404],
      [{ child_id: ids.child, item_id: bItems.target }, 404],
      [byB({ item_id: ids.target }), 404],
    ],
    '/api/mark': [
      [{ child_id: ids.child, item_id: ids.challenge, mark: 'bad' }, 404],
      [{ child_id: ids.child, item_id: bItems.challenge, mark: 'bad' }, 404],
      [byB({ item_id: ids.challenge, mark: 'bad' }), 404],
    ],
    '/api/undo': [[{ id: ids.entry }, 404]],
    '/api/entry/note': [[{ id: ids.entry, note: 'from B' }, 404]],
    '/api/message': [
      [{ child_id: ids.child, text: 'from B' }, 404],
      [{ child_id: ids.child, text: '' }, 404],
    ],
    // These routes name no ID: they act on B's own family, whatever the body says about A.
    '/api/family/save': [
      [
        { family_id: fidA, id: fidA, name: 'B renamed', timezone: 'Asia/Tokyo', week_start: 0 },
        200,
      ],
    ],
    '/api/child/save': [
      [{ id: ids.child, name: 'Hacked' }, 404],
      [{ id: ids.child2, name: 'Hacked' }, 404],
      [{ family_id: fidA, name: 'Added to B' }, 200],
    ],
    '/api/child/delete': [
      [{ id: ids.child }, 404],
      [{ id: ids.child2 }, 404],
    ],
    '/api/invite/create': [[{ family_id: fidA }, 200]],
    '/api/invite/revoke': [[{ id: ids.invite }, 404]],
    '/api/parent/remove': [
      [{ user_id: ids.coparent }, 404],
      [{ user_id: ids.owner }, 404],
    ],
    '/api/owner/transfer': [[{ user_id: ids.coparent }, 404]],
    '/api/pairing/create': [
      [{ child_id: ids.child }, 404],
      [{ child_id: ids.child2 }, 404],
    ],
    // B's owner names A's family: the confirmation must match B's own family, so it is refused.
    '/api/family/delete': [
      [{ confirm: `${SECRET_WORD} Family` }, 400],
      [{ family_id: fidA, id: fidA, confirm: `${SECRET_WORD} Family` }, 400],
    ],
    '/api/session/revoke': [
      [{ id: ids.childSession }, 404],
      [{ id: ids.parentSession }, 404],
      [{ id: ids.coparentSession }, 404],
    ],
  };
};

for (const route of parentRouteList()) {
  test(`IS-01 ${route} from another family cannot touch family A`, async () => {
    const list = cases()[route];
    assert.ok(list, `no cross-family case for ${route}: add one to test/isolation.test.js`);
    for (const [body, status] of list) {
      const beforeDb = dump(fidA);
      const beforeView = await aView();
      const r = await srv.api(B.jar, route, body);
      assert.equal(r.status, status, `${route} ${JSON.stringify(body)}: ${r.text}`);
      if (status === 404)
        assert.deepEqual(
          r.json,
          { error: 'not found', code: 'notFound' },
          'a 404 says nothing about A',
        );
      assert.ok(!r.text.includes(SECRET_WORD), `${route} reply leaks family A`);
      assert.equal(dump(fidA), beforeDb, `${route} ${JSON.stringify(body)} changed A's data`);
      assert.equal(await aView(), beforeView, `${route} changed what A sees`);
    }
  });
}

test('IS-02 every case in this file is for a route that still exists', () => {
  const routes = new Set(parentRouteList());
  for (const route of Object.keys(cases()))
    assert.ok(routes.has(route), `${route} is gone from routes.js`);
});

test("IS-03 family B never sees any of A's names, whatever it asks for", async () => {
  for (const q of [
    '',
    `?child=${ids.child}`,
    `?child=${ids.child2}`,
    `?week=2020-01-01&child=${ids.child}`,
  ]) {
    for (const j of [B.jar, kidDevB.jar]) {
      const S = await srv.api(j, `/api/state${q}`);
      assert.equal(S.status, 200);
      assert.ok(!S.text.includes(SECRET_WORD), `state${q} contains a family A name`);
    }
  }
  const S = (await srv.api(B.jar, `/api/state?child=${ids.child}`)).json;
  assert.notEqual(S.childId, ids.child, "?child= with A's child falls back to B's own");
  assert.equal(S.childName, 'Plain Kid');
  assert.ok(S.children.every((c) => c.id !== ids.child && c.id !== ids.child2));
  assert.ok(S.parents.every((p) => p.id !== ids.owner && p.id !== ids.coparent));
  assert.ok(S.devices.every((d) => ![ids.childSession, ids.parentSession].includes(d.id)));
  assert.ok(S.invites.every((i) => i.id !== ids.invite));
});

test("IS-04 a child device of B asking for A's child still sees only its own child", async () => {
  const K = (await srv.api(kidDevB.jar, `/api/state?child=${ids.child}`)).json;
  assert.equal(K.childName, 'Plain Kid');
  assert.deepEqual(
    K.children.map((c) => c.id),
    [B.childId],
  );
});

test("IS-05 family A's data and its names survive all of the attacks", async () => {
  const S = (await srv.api(A.jar, `/api/state?child=${ids.child}`)).json;
  assert.equal(S.family.name, `${SECRET_WORD} Family`);
  assert.equal(S.family.timezone, 'UTC');
  assert.equal(S.children.length, 2);
  assert.equal(S.parents.length, 2);
  assert.ok(S.items.some((i) => i.name === `${SECRET_WORD} Chore`));
  assert.equal(S.rewards.filter((r) => r.name.startsWith(SECRET_WORD)).length, 1);
  assert.equal(S.invites.length, 1, 'the unused invite is still there');
});

test("IS-06 B's own changes through those routes landed in B only", async () => {
  const S = (await srv.api(B.jar, '/api/state')).json;
  assert.equal(S.family.name, 'B renamed');
  assert.ok(S.children.some((c) => c.name === 'Added to B'));
});

test('IS-07 a parent of A is a parent of A only: A2 cannot reach B either', async () => {
  const r = await srv.api(A2, '/api/item/delete', { id: bItems.target });
  assert.equal(r.status, 404);
  assert.equal(
    (await srv.api(A2, '/api/add', { child_id: B.childId, item_id: bItems.target })).status,
    404,
  );
  assert.ok((await srv.api(B.jar, '/api/state')).json.items.some((i) => i.id === bItems.target));
});

// Keep this last: it deletes family B.
test("IS-08 B's owner deleting with their own family name deletes B only, never A", async () => {
  const beforeDb = dump(fidA);
  const beforeView = await aView();
  const r = await srv.api(B.jar, '/api/family/delete', {
    family_id: fidA,
    id: fidA,
    confirm: 'B renamed',
  });
  assert.equal(r.status, 200, r.text);
  assert.ok(!r.text.includes(SECRET_WORD));
  assert.equal(dump(fidA), beforeDb, "A's data is unchanged");
  assert.equal(await aView(), beforeView, 'A sees exactly what it saw');
  assert.equal(
    srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM families').get().n),
    1,
    'only A is left',
  );
  assert.equal((await srv.api(B.jar, '/api/state')).status, 401, 'B is gone');
  assert.equal((await srv.api(kidDevB.jar, '/api/state')).status, 401);
  assert.equal(
    (await srv.api(A.jar, `/api/state?child=${ids.child}`)).json.family.name,
    `${SECRET_WORD} Family`,
  );
});
