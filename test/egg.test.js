// The hidden emoji picker: a child picks their own emoji for what their device shows, when a
// parent allows it (on by default). See docs/design.md, "Easter egg".
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { startServer, item, tmpDir, removeDir } = require('./helpers');

let srv;
let A;
let kid;
let robin;
let sky;
before(async () => {
  srv = await startServer({ signup: 'open' });
  A = await srv.newFamily({ child: 'Robin' });
  robin = A.childId;
  const S = (await srv.api(A.jar, '/api/child/save', { name: 'Sky' })).json;
  sky = S.children.find((c) => c.name === 'Sky').id;
  kid = await srv.pairChild(A.jar, robin);
});
after(() => srv.close());

const pick = (j, kind, id, emoji) => srv.api(j, '/api/child/emoji', { kind, id, emoji });
const kidState = async () => (await srv.api(kid.jar, '/api/state')).json;

test("EG-01 on by default; a child's pick shows on that child's devices only, in items, rewards and history; '' goes back", async () => {
  const P = (await srv.api(A.jar, '/api/state')).json;
  assert.ok(
    P.children.every((c) => c.own_emoji === 1),
    'on for every child',
  );
  let K = await kidState();
  assert.equal(K.ownEmoji, true, "the child's device knows it may pick");
  const tidy = item(K, 'target', 'Tidy room');
  const reward = K.rewards.find((r) => r.name === 'New book');
  await srv.api(A.jar, '/api/add', { child_id: robin, item_id: tidy.id });

  let r = await pick(kid.jar, 'item', tidy.id, '🐉');
  assert.equal(r.status, 200);
  K = r.json;
  assert.equal(item(K, 'target', 'Tidy room').emoji, '🐉');
  assert.equal(item(K, 'target', 'Tidy room').picked, true);
  assert.equal(K.hist.find((h) => h.name === 'Tidy room').emoji, '🐉', 'history too');
  r = await pick(kid.jar, 'reward', reward.id, '🚀');
  assert.equal(r.json.rewards.find((x) => x.id === reward.id).emoji, '🚀');
  r = await pick(kid.jar, 'reward', reward.id, '🦄');
  assert.equal(r.json.rewards.find((x) => x.id === reward.id).emoji, '🦄', 'changed again');

  // Another device of the same child sees it; the parents and the other child don't.
  const kid2 = await srv.pairChild(A.jar, robin);
  assert.equal(
    item((await srv.api(kid2.jar, '/api/state')).json, 'target', 'Tidy room').emoji,
    '🐉',
  );
  const parent = (await srv.api(A.jar, `/api/state?child=${robin}`)).json;
  assert.equal(item(parent, 'target', 'Tidy room').emoji, '🧹', "the parents' list is unchanged");
  assert.equal(parent.hist.find((h) => h.name === 'Tidy room').emoji, '🧹');
  assert.equal(parent.ownEmoji, undefined);
  const skyKid = await srv.pairChild(A.jar, sky);
  assert.equal(
    item((await srv.api(skyKid.jar, '/api/state')).json, 'target', 'Tidy room').emoji,
    '🧹',
  );

  K = (await pick(kid.jar, 'item', tidy.id, '')).json;
  assert.equal(item(K, 'target', 'Tidy room').emoji, '🧹', "'' goes back to the family's");
  assert.equal(item(K, 'target', 'Tidy room').picked, undefined);
});

test("EG-02 a child can't pick for a penalty, an item or reward not meant for them, or with something that isn't one emoji", async () => {
  const P = (await srv.api(A.jar, '/api/state')).json;
  const penalty = item(P, 'penalty');
  assert.equal(
    (await pick(kid.jar, 'item', penalty.id, '🐉')).status,
    404,
    'penalties are never shown',
  );
  // A challenge and a reward for Sky only.
  let S = (
    await srv.api(A.jar, '/api/item/save', { kind: 'challenge', name: 'Sky only', children: [sky] })
  ).json;
  const skyChallenge = item(S, 'challenge', 'Sky only');
  S = (
    await srv.api(A.jar, '/api/reward/save', {
      name: 'Sky prize',
      stars: 1,
      points: 0,
      children: [sky],
    })
  ).json;
  const skyReward = S.rewards.find((r) => r.name === 'Sky prize');
  assert.equal((await pick(kid.jar, 'item', skyChallenge.id, '🐉')).status, 404);
  assert.equal((await pick(kid.jar, 'reward', skyReward.id, '🐉')).status, 404);
  assert.equal((await pick(kid.jar, 'item', 999999, '🐉')).status, 404);
  const tidy = item(P, 'target', 'Tidy room');
  for (const bad of ['ab', '🐉🐉', '<b>', 'x'.repeat(40)]) {
    assert.equal((await pick(kid.jar, 'item', tidy.id, bad)).status, 400, bad);
  }
  assert.equal((await pick(kid.jar, 'penalty', tidy.id, '🐉')).status, 400, 'an unknown kind');
  assert.equal(
    srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM child_emoji').get().n),
    1,
    "only EG-01's reward pick is stored",
  );
});

test("EG-03 turned off: the child's device can't pick, its picks are cleared and hidden; a parent can't use the child route", async () => {
  const P = (await srv.api(A.jar, '/api/state')).json;
  const tidy = item(P, 'target', 'Tidy room');
  await pick(kid.jar, 'item', tidy.id, '🐉');
  let S = (await srv.api(A.jar, '/api/child/own-emoji', { child_id: robin, on: false })).json;
  assert.equal(S.children.find((c) => c.id === robin).own_emoji, 0);
  let K = await kidState();
  assert.equal(K.ownEmoji, undefined);
  assert.equal(item(K, 'target', 'Tidy room').emoji, '🧹');
  assert.equal((await pick(kid.jar, 'item', tidy.id, '🐉')).status, 403);
  assert.equal(
    srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM child_emoji WHERE child_id=?').get(robin).n),
    0,
    'cleared',
  );
  S = (await srv.api(A.jar, '/api/child/own-emoji', { child_id: robin, on: true })).json;
  assert.equal(S.children.find((c) => c.id === robin).own_emoji, 1);
  K = await kidState();
  assert.equal(K.ownEmoji, true);
  assert.equal(item(K, 'target', 'Tidy room').emoji, '🧹', 'on again, with nothing picked');
  assert.equal((await pick(A.jar, 'item', tidy.id, '🐉')).status, 404, 'not a parent route');
  assert.equal(
    (await srv.api(kid.jar, '/api/child/own-emoji', { child_id: robin, on: false })).status,
    403,
    "a child can't change the switch",
  );
  assert.equal(
    (await srv.api(A.jar, '/api/child/own-emoji', { child_id: 999999, on: false })).status,
    404,
  );
});

test('EG-04 deleting a reward or a child removes its picks; the export includes them', async () => {
  const S = (await srv.api(A.jar, '/api/reward/save', { name: 'Gone soon', stars: 1, points: 0 }))
    .json;
  const gone = S.rewards.find((r) => r.name === 'Gone soon');
  const tidy = item(S, 'target', 'Tidy room');
  await pick(kid.jar, 'reward', gone.id, '🎈');
  await pick(kid.jar, 'item', tidy.id, '🐉');
  const skyKid = await srv.pairChild(A.jar, sky);
  await pick(skyKid.jar, 'item', tidy.id, '🐼');
  const ex = (await srv.api(A.jar, '/api/export')).json;
  assert.deepEqual(
    ex.childEmoji.map((r) => `${r.child_id}:${r.kind}:${r.emoji}`).sort(),
    [`${robin}:item:🐉`, `${robin}:reward:🎈`, `${sky}:item:🐼`].sort(),
  );
  await srv.api(A.jar, '/api/reward/delete', { id: gone.id });
  const count = (sql) => srv.sql((db) => db.prepare(sql).get().n);
  assert.equal(count("SELECT COUNT(*) n FROM child_emoji WHERE kind='reward' AND emoji='🎈'"), 0);
  await srv.api(A.jar, '/api/child/delete', { id: sky });
  assert.equal(count(`SELECT COUNT(*) n FROM child_emoji WHERE child_id=${sky}`), 0);
});

test('EG-05 migration 12 turns it on for existing children', () => {
  const dir = tmpDir('egg-migrate');
  try {
    const file = path.join(dir, 'v11.db');
    const db = require('../server/db').open(file);
    // Back to a version-11 database with a family and a child, then migrate again.
    db.exec(`
      DROP TABLE IF EXISTS settings;
      DROP TABLE child_emoji;
      ALTER TABLE children DROP COLUMN own_emoji;
      PRAGMA user_version = 11;
      INSERT INTO families(name, timezone, created) VALUES('Old', 'UTC', '2026-01-01');
      INSERT INTO children(family_id, name, sort, created) VALUES(last_insert_rowid(), 'Kid', 1, '2026-01-01');
    `);
    db.close();
    const again = require('../server/db').open(file);
    assert.deepEqual(
      again
        .prepare('SELECT own_emoji FROM children')
        .all()
        .map((c) => c.own_emoji),
      [1],
    );
    assert.ok(again.prepare('PRAGMA user_version').get().user_version >= 12);
    again.close();
  } finally {
    removeDir(dir);
  }
});
