// The child's Today line: points earned today.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, item } = require('./helpers');

let srv;
before(async () => {
  srv = await startServer({ signup: 'open' });
});
after(() => srv.close());

test("FT-01 todayPoints counts the chosen child's positive points from today only", async () => {
  const f = await srv.newFamily({ child: 'Robin' });
  assert.equal(f.state.todayPoints, 0);
  const two = (await srv.api(f.jar, '/api/child/save', { name: 'Sky' })).json;
  const sky = two.children.find((c) => c.name === 'Sky').id;
  const tidy = item(f.state, 'target', 'Tidy room'); // 10
  const penalty = f.state.items.find((i) => i.kind === 'penalty');
  await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: tidy.id });
  await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: tidy.id });
  await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: penalty.id });
  await srv.api(f.jar, '/api/add', { child_id: sky, item_id: tidy.id });
  // An entry from yesterday does not count.
  srv.sql((db) =>
    db
      .prepare(
        'INSERT INTO entries(family_id,child_id,item_id,kind,points,day,ts,who) SELECT family_id,?,?,?,?,?,?,? FROM children WHERE id=?',
      )
      .run(
        f.childId,
        tidy.id,
        'points',
        50,
        '2000-01-01',
        '2000-01-01T12:00:00.000Z',
        'Parent',
        f.childId,
      ),
  );
  const S = (await srv.api(f.jar, `/api/state?child=${f.childId}`)).json;
  assert.equal(S.todayPoints, 20, 'two tidy rooms; not the penalty, not Sky, not yesterday');
  const kid = await srv.pairChild(f.jar, sky);
  assert.equal((await srv.api(kid.jar, '/api/state')).json.todayPoints, 10);
});
