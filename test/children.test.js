// Several children in one family: adding, renaming, deleting, and keeping each child's points,
// stars, history and marks apart. What a child's own device may see.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { shift } = require('../server/scoring');
const { startServer, item } = require('./helpers');

let srv;
let F;
let one;
let two;
const get = async (j = F.jar, q = '') => (await srv.api(j, `/api/state${q}`)).json;
const post = (p, b, j = F.jar) => srv.api(j, p, b);

before(async () => {
  srv = await startServer({ signup: 'open' });
  F = await srv.newFamily({ name: 'Many Kids', child: 'Ann' });
  one = F.childId;
});
after(() => srv.close());

test('a parent adds a child, who is selected in the reply', async () => {
  const r = await post('/api/child/save', { name: '  Ben  ' });
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.json.children.map((c) => c.name),
    ['Ann', 'Ben'],
  );
  two = r.json.childId;
  assert.equal(r.json.childName, 'Ben');
  assert.notEqual(two, one);
  assert.equal((await post('/api/child/save', { name: '   ' })).status, 400);
  assert.equal(
    (await post('/api/child/save', { name: 'x'.repeat(100) })).json.children.at(-1).name.length,
    40,
  );
});

test('the child query parameter picks the child, and the first is the default', async () => {
  assert.equal((await get()).childName, 'Ann');
  assert.equal((await get(F.jar, `?child=${two}`)).childName, 'Ben');
  assert.equal((await get(F.jar, '?child=999999')).childName, 'Ann', 'unknown child falls back');
  assert.equal((await get(F.jar, '?child=garbage')).childName, 'Ann');
});

test('points, warnings, marks and stars are kept per child', async () => {
  const S = await get();
  const t = item(S, 'target', 'Reading 20 min');
  const ch = item(S, 'challenge');
  const body = (cid, extra) => ({ child_id: cid, item_id: t.id, ...extra });
  await post('/api/add', body(one));
  await post('/api/add', body(one));
  await post('/api/warn', body(one));
  await post('/api/add', body(two));
  const mk = (cid, day, mark) =>
    post(`/api/mark?week=${S.week.prev}&child=${cid}`, {
      child_id: cid,
      item_id: ch.id,
      mark,
      day,
    });
  await mk(one, shift(S.week.prev, 0), 'perfect');
  await mk(one, shift(S.week.prev, 1), 'perfect');
  await mk(two, shift(S.week.prev, 0), 'perfect');
  await mk(two, shift(S.week.prev, 1), 'bad');

  const A = await get(F.jar, `?child=${one}`);
  const B = await get(F.jar, `?child=${two}`);
  assert.equal(A.balance, 10);
  assert.equal(B.balance, 5);
  assert.equal(A.warn[t.id], 1, 'one warning for the first child');
  assert.equal(B.warn[t.id], undefined, 'none for the second');
  assert.equal(A.stars, 1);
  assert.equal(B.stars, 0, 'the other child has a bad day in the same week');
  const W = (c) => get(F.jar, `?week=${S.week.prev}&child=${c}`);
  assert.deepEqual((await W(one)).week.marks[ch.id].slice(0, 2), ['perfect', 'perfect']);
  assert.deepEqual((await W(two)).week.marks[ch.id].slice(0, 2), ['perfect', 'bad']);
  const pts = (S2) => S2.hist.filter((h) => h.kind === 'points');
  assert.equal(pts(A).length, 2);
  assert.equal(pts(B).length, 1);
  assert.equal(A.hist.length, 5, 'two points, a warning and two marks');
  assert.equal(B.hist.length, 3, 'one points entry and two marks');
  assert.ok(
    A.hist.every((h) => B.hist.every((o) => o.id !== h.id)),
    'no entry is shared',
  );
});

test("one child's entry can be undone without touching the other", async () => {
  const B = await get(F.jar, `?child=${two}`);
  const r = await post(`/api/undo?child=${two}`, {
    id: B.hist.find((h) => h.kind === 'points').id,
  });
  assert.equal(r.status, 200);
  assert.equal((await get(F.jar, `?child=${two}`)).balance, 0);
  assert.equal((await get(F.jar, `?child=${one}`)).balance, 10);
});

test('a child device always sees only its own child, even asking for a sibling', async () => {
  const dev = await srv.pairChild(F.jar, two);
  for (const q of ['', `?child=${one}`, `?child=${two}`, '?child=999999']) {
    const K = await get(dev.jar, q);
    assert.equal(K.childName, 'Ben', q);
    assert.equal(K.childId, two, q);
    assert.deepEqual(
      K.children.map((c) => c.name),
      ['Ben'],
      'the sibling is not even listed',
    );
    assert.equal(K.balance, 0);
    assert.ok(!JSON.stringify(K).includes('Ann'), 'no trace of the sibling');
  }
  const K = await get(dev.jar);
  for (const key of ['devices', 'parents', 'invites', 'me']) assert.equal(key in K, false, key);
  assert.deepEqual(K.warn, {});
  assert.equal(
    K.items.some((i) => i.kind === 'penalty'),
    false,
  );
  assert.ok(K.hist.every((h) => h.points > 0 && h.note === ''));
  const A = await srv.pairChild(F.jar, one);
  assert.equal(
    (await get(A.jar, `?child=${two}`)).balance,
    10,
    'the first child sees their own 10',
  );
});

test('a parent renames a child; an unknown child is a 404', async () => {
  const r = await post('/api/child/save', { id: two, name: 'Benji' });
  assert.equal(r.status, 200);
  assert.deepEqual(
    r.json.children.map((c) => c.name),
    ['Ann', 'Benji', 'x'.repeat(40)],
  );
  assert.equal((await post('/api/child/save', { id: 999999, name: 'Z' })).status, 404);
  assert.equal((await post('/api/child/save', { id: two, name: '' })).status, 400);
});

test('deleting a child removes their history, devices and codes, and not the others', async () => {
  const dev = await srv.pairChild(F.jar, two);
  const code = await srv.api(F.jar, '/api/pairing/create', { child_id: two });
  const r = await post('/api/child/delete', { id: two });
  assert.equal(r.status, 200);
  assert.ok(!r.json.children.some((c) => c.id === two));
  assert.equal(r.json.childId, one, 'the view goes back to the first child');
  const left = srv.sql((db) => ({
    entries: db.prepare('SELECT COUNT(*) n FROM entries WHERE child_id=?').get(two).n,
    codes: db.prepare('SELECT COUNT(*) n FROM pairings WHERE child_id=?').get(two).n,
    sessions: db.prepare('SELECT COUNT(*) n FROM sessions WHERE child_id=?').get(two).n,
    others: db.prepare('SELECT COUNT(*) n FROM entries WHERE child_id=?').get(one).n,
  }));
  assert.deepEqual(left.entries + left.codes + left.sessions, 0, 'nothing of the child is left');
  assert.ok(left.others > 0, "the sibling's history stays");
  assert.equal(
    (await srv.api(dev.jar, '/api/state')).status,
    401,
    "the child's device is logged out",
  );
  assert.equal(
    (await srv.api(null, '/api/pair', { code: code.json.issued.code })).status,
    400,
    'a code for a deleted child is refused',
  );
  assert.equal((await post('/api/child/delete', { id: two })).status, 404, 'already gone');
  assert.equal(
    (await post('/api/add', { child_id: two, item_id: item(r.json, 'target').id })).status,
    404,
  );
});

test('the last child cannot be deleted', async () => {
  let S = await get();
  while (S.children.length > 1)
    S = (await post('/api/child/delete', { id: S.children.at(-1).id })).json;
  assert.equal(S.children.length, 1);
  const r = await post('/api/child/delete', { id: S.children[0].id });
  assert.equal(r.status, 400);
  assert.equal((await get()).children.length, 1);
});

test('a child device cannot add, rename or delete children', async () => {
  const dev = await srv.pairChild(F.jar, one);
  for (const [p, b] of [
    ['/api/child/save', { name: 'Sneaky' }],
    ['/api/child/save', { id: one, name: 'Sneaky' }],
    ['/api/child/delete', { id: one }],
  ])
    assert.equal((await srv.api(dev.jar, p, b)).status, 403, p);
});
