// The weekly review (GET /api/review): parents only, one child of their own family.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, item } = require('./helpers');

let srv;
let A;
let B;
before(async () => {
  srv = await startServer({ signup: 'open' });
  A = await srv.newFamily({ name: 'Review Family', child: 'First' });
  B = await srv.newFamily({ name: 'Other Family', child: 'Stranger' });
});
after(() => srv.close());

test('RV-01 the review sums the chosen week for the chosen child, with the last four weeks', async () => {
  const S = A.state;
  const second = (await srv.api(A.jar, '/api/child/save', { name: 'Second' })).json;
  const secondId = second.children.find((c) => c.name === 'Second').id;
  const reading = item(S, 'target', 'Reading 20 min'); // 5 points
  const penalty = S.items.find((i) => i.kind === 'penalty');
  const challenge = S.items.find((i) => i.kind === 'challenge');
  await srv.api(A.jar, '/api/add', { child_id: A.childId, item_id: reading.id });
  await srv.api(A.jar, '/api/add', { child_id: A.childId, item_id: reading.id });
  await srv.api(A.jar, '/api/add', { child_id: A.childId, item_id: penalty.id });
  await srv.api(A.jar, '/api/warn', { child_id: A.childId, item_id: reading.id });
  await srv.api(A.jar, '/api/mark', {
    child_id: A.childId,
    item_id: challenge.id,
    mark: 'perfect',
  });
  await srv.api(A.jar, '/api/add', { child_id: secondId, item_id: reading.id });

  const r = await srv.api(A.jar, `/api/review?child=${A.childId}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.child.name, 'First');
  assert.equal(r.json.current, true);
  assert.equal(r.json.week.earned, 10);
  assert.equal(r.json.week.lost, penalty.pmin);
  assert.equal(r.json.week.warnings, 1);
  assert.equal(r.json.week.perfectDays, 1);
  assert.deepEqual(r.json.top[0], { name: 'Reading 20 min', times: 2, points: 10 });
  assert.equal(r.json.recent.length, 4);
  assert.equal(r.json.recent.at(-1).start, r.json.start);
  assert.ok(r.json.challenges.some((c) => c.id === challenge.id && c.marks.includes('perfect')));

  const other = await srv.api(A.jar, `/api/review?child=${secondId}`);
  assert.equal(other.json.week.earned, 5, 'only that child');
  const last = await srv.api(A.jar, `/api/review?child=${A.childId}&week=${r.json.prev}`);
  assert.equal(last.json.current, false);
  assert.equal(last.json.week.earned, 0);
});

test("RV-02 a child's device and a signed-out visitor cannot read it, and it is read-only", async () => {
  const kid = await srv.pairChild(A.jar, A.childId);
  assert.equal((await srv.api(kid.jar, `/api/review?child=${A.childId}`)).status, 403);
  assert.equal((await srv.api(null, `/api/review?child=${A.childId}`)).status, 401);
  assert.equal((await srv.api(A.jar, '/api/review', {})).status, 405);
});

test("RV-03 another family's child is unknown: the review answers 404 and shows nothing of it", async () => {
  const r = await srv.api(B.jar, `/api/review?child=${A.childId}`);
  assert.equal(r.status, 404);
  assert.doesNotMatch(r.text, /First|Review Family/);
  const own = await srv.api(B.jar, '/api/review');
  assert.equal(own.json.child.name, 'Stranger', 'no child given: their own first child');
});
