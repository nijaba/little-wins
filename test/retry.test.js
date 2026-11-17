// A write sent again with the same X-Request-Id (the page retries once after a network
// failure) is applied once.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, item } = require('./helpers');

const add = (srv, f, itemId, rid) =>
  srv.api(
    f.jar,
    '/api/add',
    { child_id: f.childId, item_id: itemId },
    rid ? { headers: { 'X-Request-Id': rid } } : {},
  );

test('RT-01 a write repeated with the same X-Request-Id is applied once', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const f = await srv.newFamily();
    const t = item((await srv.api(f.jar, '/api/state')).json, 'target');
    const first = await add(srv, f, t.id, 'retry-0001-aaaa');
    assert.equal(first.status, 200);
    const again = await add(srv, f, t.id, 'retry-0001-aaaa');
    assert.equal(again.status, 200);
    assert.equal(again.json.balance, first.json.balance, 'the repeat answers with the same state');
    const other = await add(srv, f, t.id, 'retry-0002-bbbb');
    assert.ok(other.json.balance > first.json.balance, 'a new ID is a new write');
    const plain = await add(srv, f, t.id);
    assert.ok(plain.json.balance > other.json.balance, 'no ID: every write applies');
    const bad = await add(srv, f, t.id, 'x');
    assert.ok(bad.json.balance > plain.json.balance, 'a malformed ID is ignored');
    assert.ok((await add(srv, f, t.id, 'x')).json.balance > bad.json.balance);
  } finally {
    await srv.close();
  }
});

test("RT-02 the same X-Request-Id in another family is that family's own write", async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const A = await srv.newFamily();
    const B = await srv.newFamily({ name: 'Other Family' });
    const ta = item((await srv.api(A.jar, '/api/state')).json, 'target');
    const tb = item((await srv.api(B.jar, '/api/state')).json, 'target');
    assert.equal((await add(srv, A, ta.id, 'shared-id-1234')).status, 200);
    const b = await add(srv, B, tb.id, 'shared-id-1234');
    assert.equal(b.status, 200);
    assert.ok(b.json.balance > 0, "B's write applied");
  } finally {
    await srv.close();
  }
});

test('RT-03 a failed write is not remembered, so its retry is applied', async () => {
  const srv = await startServer({ signup: 'open' });
  try {
    const f = await srv.newFamily();
    const t = item((await srv.api(f.jar, '/api/state')).json, 'target');
    const h = { headers: { 'X-Request-Id': 'retry-0003-cccc' } };
    const bad = await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: 999999 }, h);
    assert.notEqual(bad.status, 200);
    const ok = await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: t.id }, h);
    assert.equal(ok.status, 200);
    assert.ok(ok.json.balance > 0);
  } finally {
    await srv.close();
  }
});
