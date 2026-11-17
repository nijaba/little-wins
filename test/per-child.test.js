// Behaviors, penalties, challenges and rewards for some children only.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, item } = require('./helpers');

let srv;
let A;
let mia;
let leo;
before(async () => {
  srv = await startServer({ signup: 'open' });
  A = await srv.newFamily({ name: 'Two Kids', child: 'Mia' });
  mia = A.childId;
  const S = (await srv.api(A.jar, '/api/child/save', { name: 'Leo' })).json;
  leo = S.children.find((c) => c.name === 'Leo').id;
});
after(() => srv.close());

const state = (child) => srv.api(A.jar, `/api/state?child=${child}`).then((r) => r.json);

test('PC-01 an item for one child shows and records for that child only', async () => {
  let S = (
    await srv.api(A.jar, '/api/item/save', {
      kind: 'target',
      name: 'Piano practice',
      pmin: 10,
      pmax: 10,
      children: [mia],
    })
  ).json;
  const piano = item(S, 'target', 'Piano practice');
  assert.deepEqual(piano.for, [mia], 'parents see who it is for');
  assert.equal(item(S, 'target', 'Reading 20 min').for, null, 'the rest is for everyone');
  assert.equal(
    (await srv.api(A.jar, '/api/add', { child_id: mia, item_id: piano.id })).status,
    200,
  );
  const refused = await srv.api(A.jar, '/api/add', { child_id: leo, item_id: piano.id });
  assert.equal(refused.status, 400, "not for Leo: can't be recorded for him");
  const leoDev = await srv.pairChild(A.jar, leo);
  const miaDev = await srv.pairChild(A.jar, mia);
  assert.ok(
    !(await srv.api(leoDev.jar, '/api/state')).json.items.some((i) => i.name === 'Piano practice'),
  );
  assert.ok(
    (await srv.api(miaDev.jar, '/api/state')).json.items.some((i) => i.name === 'Piano practice'),
  );
  S = (
    await srv.api(A.jar, '/api/item/save', {
      id: piano.id,
      kind: 'target',
      name: 'Piano practice',
      pmin: 10,
      pmax: 10,
      children: null,
    })
  ).json;
  assert.equal(item(S, 'target', 'Piano practice').for, null, 'null means everyone again');
  assert.equal(
    (await srv.api(A.jar, '/api/add', { child_id: leo, item_id: piano.id })).status,
    200,
  );
});

test("PC-02 a challenge and a reward for one child: the other child's week and rewards leave them out", async () => {
  let S = (
    await srv.api(A.jar, '/api/item/save', {
      kind: 'challenge',
      name: 'Swim club',
      children: [leo],
    })
  ).json;
  const swim = item(S, 'challenge', 'Swim club');
  S = (
    await srv.api(A.jar, '/api/reward/save', {
      name: 'Lego set',
      stars: 1,
      points: 0,
      children: [leo],
    })
  ).json;
  const lego = S.rewards.find((r) => r.name === 'Lego set');
  assert.deepEqual(lego.for, [leo]);
  assert.ok(swim.id in (await state(leo)).week.marks);
  assert.ok(!(swim.id in (await state(mia)).week.marks), "not in Mia's week");
  assert.equal(
    (await srv.api(A.jar, '/api/mark', { child_id: mia, item_id: swim.id, mark: 'perfect' }))
      .status,
    400,
  );
  const miaDev = await srv.pairChild(A.jar, mia);
  assert.ok(
    !(await srv.api(miaDev.jar, '/api/state')).json.rewards.some((r) => r.name === 'Lego set'),
  );
  const review = (await srv.api(A.jar, `/api/review?child=${mia}`)).json;
  assert.ok(!review.challenges.some((c) => c.id === swim.id), "Mia's review leaves it out");
});

test("PC-03 ticking every child means everyone; another family's children are dropped; a deleted child leaves 'nobody'", async () => {
  const B = await srv.newFamily({ name: 'Elsewhere', child: 'Zed' });
  let S = (
    await srv.api(A.jar, '/api/item/save', {
      kind: 'target',
      name: 'Both',
      pmin: 5,
      pmax: 5,
      children: [mia, leo],
    })
  ).json;
  assert.equal(item(S, 'target', 'Both').for, null, 'every child ticked = everyone');
  S = (
    await srv.api(A.jar, '/api/item/save', {
      kind: 'target',
      name: 'Mixed',
      pmin: 5,
      pmax: 5,
      children: [mia, B.childId],
    })
  ).json;
  assert.deepEqual(item(S, 'target', 'Mixed').for, [mia], "B's child is not A's to choose");
  S = (await srv.api(A.jar, '/api/child/save', { name: 'Ada' })).json;
  const ada = S.children.find((c) => c.name === 'Ada').id;
  S = (
    await srv.api(A.jar, '/api/item/save', {
      kind: 'target',
      name: 'Only Ada',
      pmin: 5,
      pmax: 5,
      children: [ada],
    })
  ).json;
  assert.ok(
    item(await state(ada), 'target', 'Both'),
    'an item for everyone covers a child added later',
  );
  S = (await srv.api(A.jar, '/api/child/delete', { id: ada })).json;
  assert.deepEqual(
    item(S, 'target', 'Only Ada').for,
    [],
    'for nobody now, never suddenly for everyone',
  );
  const exported = (await srv.api(A.jar, '/api/export')).json;
  assert.ok(exported.itemsFor.some((r) => r.child_id === mia));
  assert.equal(exported.items.find((i) => i.name === 'Mixed').for_all, 0);
  const bState = (await srv.api(B.jar, '/api/state')).json;
  assert.ok(!bState.items.some((i) => i.name === 'Mixed'), 'nothing crosses to B');
});
