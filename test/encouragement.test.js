// Encouragement: a parent's message to a child, shown on the child's Today for a week.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

let srv;
let A;
before(async () => {
  srv = await startServer({ signup: 'open' });
  A = await srv.newFamily({ name: 'Cheer Family', child: 'Robin' });
});
after(() => srv.close());

test('EN-01 a parent writes, replaces and clears a message; the child sees it on their device', async () => {
  const kid = await srv.pairChild(A.jar, A.childId);
  let S = (await srv.api(A.jar, '/api/message', { child_id: A.childId, text: '  Proud of you!  ' }))
    .json;
  assert.equal(S.message.text, 'Proud of you!');
  assert.ok(S.message.who, 'signed with the parent name');
  const K = (await srv.api(kid.jar, '/api/state')).json;
  assert.equal(K.message.text, 'Proud of you!');
  S = (await srv.api(A.jar, '/api/message', { child_id: A.childId, text: 'x'.repeat(300) })).json;
  assert.equal(S.message.text.length, 140, 'capped at 140 characters');
  assert.equal(
    srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM messages').get().n),
    1,
    'one per child',
  );
  S = (await srv.api(A.jar, '/api/message', { child_id: A.childId, text: '' })).json;
  assert.equal(S.message, undefined, 'an empty message clears it');
  assert.equal((await srv.api(kid.jar, '/api/state')).json.message, undefined);
});

test('EN-02 a message shows for 7 days, belongs to one child, and goes with the child', async () => {
  const two = (await srv.api(A.jar, '/api/child/save', { name: 'Sky' })).json;
  const sky = two.children.find((c) => c.name === 'Sky').id;
  await srv.api(A.jar, '/api/message', { child_id: sky, text: 'For Sky only' });
  assert.equal((await srv.api(A.jar, `/api/state?child=${A.childId}`)).json.message, undefined);
  assert.equal((await srv.api(A.jar, `/api/state?child=${sky}`)).json.message.text, 'For Sky only');
  const exported = (await srv.api(A.jar, '/api/export')).json;
  assert.deepEqual(
    exported.messages.map((m) => m.text),
    ['For Sky only'],
    'the export includes it',
  );
  srv.sql((db) =>
    db.prepare('UPDATE messages SET created=?').run(new Date(Date.now() - 8 * 864e5).toISOString()),
  );
  assert.equal(
    (await srv.api(A.jar, `/api/state?child=${sky}`)).json.message,
    undefined,
    'faded after a week',
  );
  await srv.api(A.jar, '/api/child/delete', { id: sky });
  assert.equal(
    srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM messages').get().n),
    0,
  );
});

test("EN-03 a child's device cannot write a message, and an unknown child is a 404", async () => {
  const kid = await srv.pairChild(A.jar, A.childId);
  assert.equal(
    (await srv.api(kid.jar, '/api/message', { child_id: A.childId, text: 'hi' })).status,
    403,
  );
  assert.equal(
    (await srv.api(A.jar, '/api/message', { child_id: 999999, text: 'hi' })).status,
    404,
  );
});
