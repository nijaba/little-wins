// Co-parent invites, and the owner's powers over the other parents.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { jar, SESSION, startServer } = require('./helpers');

const tokenOf = (issued) => issued.link.split('#invite=')[1];

describe('invites', () => {
  let srv;
  let alice;
  const create = async () => {
    const r = await srv.api(alice.jar, '/api/invite/create', {});
    assert.equal(r.status, 200);
    return { token: tokenOf(r.json.issued), id: r.json.invites.at(-1).id, json: r.json };
  };
  const info = (token) => srv.api(null, '/api/invite/info', { token });
  const expire = (id) =>
    srv.sql((db) =>
      db.prepare('UPDATE invites SET expires=? WHERE id=?').run('2000-01-01T00:00:00.000Z', id),
    );

  before(async () => {
    srv = await startServer({ allowlist: 'google:alice@example.com,github:dan-dev' });
    alice = await srv.newFamily({ name: 'The Examples', who: 'alice' });
  });
  after(() => srv.close());

  test('FA-01 an invite link names the family and is stored hashed', async () => {
    const { token, json } = await create();
    assert.match(json.issued.link, new RegExp(`^${srv.base}/#invite=[\\w-]{20,}$`));
    assert.ok(Date.parse(json.issued.expires) > Date.now() + 6 * 864e5, 'lasts about a week');
    assert.deepEqual(Object.keys(json.invites.at(-1)).sort(), ['created', 'expires', 'id']);
    assert.deepEqual((await info(token)).json, { familyName: 'The Examples' });
    const stored = srv.sql((db) => db.prepare('SELECT token_hash FROM invites').all());
    assert.ok(stored.every((r) => r.token_hash !== token && r.token_hash.length === 64));
  });

  test('FA-02 unknown, short or missing invite tokens are 404', async () => {
    assert.equal((await info('x'.repeat(30))).status, 404);
    assert.equal((await srv.api(null, '/api/invite/info', {})).status, 404);
  });

  test('FA-03 a parent joins through sign-in carrying the invite, even if not on the allowlist', async () => {
    const { token } = await create();
    const bob = jar();
    const r = await srv.signIn(bob, 'google', 'bob', { invite: token });
    assert.ok(r.ok, r.body);
    const S = (await srv.api(bob, '/api/state')).json;
    assert.equal(S.family.name, 'The Examples');
    assert.deepEqual(
      S.parents.map((p) => p.role),
      ['owner', 'parent'],
    );
    assert.equal(S.me.owner, false);
    assert.equal(S.childName, 'Kid', 'the new parent sees the same children');
  });

  test('FA-04 an invite works once', async () => {
    const { token } = await create();
    assert.equal((await info(token)).status, 200);
    assert.ok((await srv.signIn(jar(), 'github', 'carol', { invite: token })).ok);
    assert.equal((await info(token)).status, 404, 'used');
    const second = jar();
    const r = await srv.signIn(
      second,
      'github',
      { sub: '1999', login: 'late-comer', name: 'Late' },
      { invite: token },
    );
    assert.equal(r.status, 403, 'a used invite does not open the closed instance');
    assert.equal(second.c[SESSION], undefined);
  });

  test('FA-05 an expired invite does not work', async () => {
    const { token, id } = await create();
    expire(id);
    assert.equal((await info(token)).status, 404);
    const j = jar();
    const r = await srv.signIn(
      j,
      'github',
      { sub: '2001', login: 'too-late', name: 'T' },
      { invite: token },
    );
    assert.equal(r.status, 403);
    const listed = (await srv.api(alice.jar, '/api/state')).json.invites;
    assert.ok(!listed.some((i) => i.id === id), 'an expired invite is not listed');
  });

  test('FA-06 a revoked invite does not work, and revoking twice is a 404', async () => {
    const { token, id } = await create();
    const r = await srv.api(alice.jar, '/api/invite/revoke', { id });
    assert.equal(r.status, 200);
    assert.ok(!r.json.invites.some((i) => i.id === id));
    assert.equal((await info(token)).status, 404);
    assert.equal((await srv.api(alice.jar, '/api/invite/revoke', { id })).status, 404);
  });

  test('FA-07 a parent who already has a family is not moved by an invite', async () => {
    const dan = jar();
    assert.ok((await srv.signIn(dan, 'github', 'dan')).ok);
    await srv.api(dan, '/api/setup', { family_name: 'Dans', child_name: 'D', timezone: 'UTC' });
    const { token } = await create();
    const again = jar();
    assert.ok((await srv.signIn(again, 'github', 'dan', { invite: token })).ok);
    assert.equal((await srv.api(again, '/api/state')).json.family.name, 'Dans');
    assert.equal((await info(token)).status, 200, 'and the invite is still unused');
  });

  test('FA-08 a child device cannot create or revoke invites', async () => {
    const dev = await srv.pairChild(alice.jar, alice.childId);
    assert.equal((await srv.api(dev.jar, '/api/invite/create', {})).status, 403);
    assert.equal((await srv.api(dev.jar, '/api/invite/revoke', { id: 1 })).status, 403);
  });
});

describe('a setup session that joins a family meanwhile', () => {
  test('FA-09 uses the family on its next request instead of staying in setup', async () => {
    const srv = await startServer({ signup: 'open' });
    try {
      const owner = await srv.newFamily({ name: 'Joined Family' });
      const invite = await srv.api(owner.jar, '/api/invite/create', {});
      const token = tokenOf(invite.json.issued);

      const who = { sub: 'g-pickup', email: 'pickup@example.test', name: 'Pickup' };
      const first = jar();
      assert.ok((await srv.signIn(first, 'google', who)).ok);
      assert.equal((await srv.api(first, '/api/state')).json.setup, true, 'still setting up here');

      const second = jar(); // another browser: same account, with the invite
      assert.ok((await srv.signIn(second, 'google', who, { invite: token })).ok);
      assert.equal((await srv.api(second, '/api/state')).json.family.name, 'Joined Family');
      assert.equal(
        (await srv.api(second, '/api/state')).json.parents.length,
        2,
        'the account is a member once',
      );

      const S = (await srv.api(first, '/api/state')).json;
      assert.equal(S.setup, undefined, 'the setup session now has the family');
      assert.equal(S.family.name, 'Joined Family');
      assert.equal(S.role, 'parent');
      assert.equal(S.me.owner, false);
      const add = await srv.api(first, '/api/item/save', {
        kind: 'target',
        name: 'From setup tab',
        pmin: 1,
        pmax: 1,
      });
      assert.equal(add.status, 200, 'and it can work in the family');
      assert.equal(
        (await srv.api(first, '/api/setup', { family_name: 'X', child_name: 'Y', timezone: 'UTC' }))
          .status,
        409,
      );
    } finally {
      await srv.close();
    }
  });
});

describe('owner powers', () => {
  let srv;
  let owner;
  let bob;
  let bobId;
  let ownerId;
  before(async () => {
    srv = await startServer({ signup: 'open' });
    owner = await srv.newFamily({ name: 'Owners' });
    const inv = await srv.api(owner.jar, '/api/invite/create', {});
    bob = jar();
    assert.ok((await srv.signIn(bob, 'google', 'bob', { invite: tokenOf(inv.json.issued) })).ok);
    const S = (await srv.api(owner.jar, '/api/state')).json;
    ownerId = S.me.userId;
    bobId = S.parents.find((p) => !p.me).id;
  });
  after(() => srv.close());

  test('FA-10 only the owner can remove a parent or transfer ownership', async () => {
    assert.equal((await srv.api(bob, '/api/parent/remove', { user_id: ownerId })).status, 403);
    assert.equal((await srv.api(bob, '/api/owner/transfer', { user_id: bobId })).status, 403);
    assert.equal((await srv.api(bob, '/api/owner/transfer', { user_id: ownerId })).status, 403);
    assert.equal((await srv.api(owner.jar, '/api/state')).json.parents.length, 2);
  });

  test('FA-11 the owner cannot remove or hand ownership to themselves', async () => {
    assert.equal(
      (await srv.api(owner.jar, '/api/parent/remove', { user_id: ownerId })).status,
      400,
    );
    assert.equal(
      (await srv.api(owner.jar, '/api/owner/transfer', { user_id: ownerId })).status,
      400,
    );
    assert.equal(
      (await srv.api(owner.jar, '/api/owner/transfer', { user_id: 999999 })).status,
      404,
    );
    assert.equal((await srv.api(owner.jar, '/api/parent/remove', { user_id: 999999 })).status, 404);
  });

  test('FA-12 after a transfer the old owner is a parent and the new owner can remove them', async () => {
    const r = await srv.api(owner.jar, '/api/owner/transfer', { user_id: bobId });
    assert.equal(r.status, 200);
    assert.equal(r.json.me.owner, false);
    assert.deepEqual(
      r.json.parents.map((p) => [p.id, p.role]).sort((a, b) => a[0] - b[0]),
      [
        [ownerId, 'parent'],
        [bobId, 'owner'],
      ].sort((a, b) => a[0] - b[0]),
    );
    assert.equal((await srv.api(bob, '/api/state')).json.me.owner, true);
    assert.equal((await srv.api(owner.jar, '/api/parent/remove', { user_id: bobId })).status, 403);
    assert.equal((await srv.api(owner.jar, '/api/owner/transfer', { user_id: bobId })).status, 403);
    // Hand it back for the next test.
    assert.equal((await srv.api(bob, '/api/owner/transfer', { user_id: ownerId })).status, 200);
  });

  test("FA-13 a removed parent's sessions stop working at once and they cannot get back in", async () => {
    const second = jar();
    assert.ok((await srv.signIn(second, 'google', 'bob')).ok, 'a second device of the same parent');
    assert.equal((await srv.api(bob, '/api/state')).status, 200);
    const r = await srv.api(owner.jar, '/api/parent/remove', { user_id: bobId });
    assert.equal(r.status, 200);
    assert.deepEqual(
      r.json.parents.map((p) => p.role),
      ['owner'],
    );
    assert.equal((await srv.api(bob, '/api/state')).status, 401);
    assert.equal((await srv.api(second, '/api/state')).status, 401);
    assert.equal((await srv.api(bob, '/api/item/save', { kind: 'target', name: 'x' })).status, 401);
    assert.ok(
      !(await srv.api(owner.jar, '/api/state')).json.devices.some((d) => d.who === 'Bob Example'),
      'their devices are gone from the list',
    );
    assert.equal(
      (await srv.api(owner.jar, '/api/state')).status,
      200,
      "the owner's session is fine",
    );
    assert.equal(
      (await srv.api(owner.jar, '/api/parent/remove', { user_id: bobId })).status,
      404,
      'already gone',
    );
  });

  test('FA-14 a parent session whose membership is gone stops working, even if the session row is left behind', async () => {
    // Defense in depth: removing a parent also deletes their sessions, but auth must not rely on it.
    const dan = jar();
    const inv = await srv.api(owner.jar, '/api/invite/create', {});
    assert.ok((await srv.signIn(dan, 'github', 'dan', { invite: tokenOf(inv.json.issued) })).ok);
    assert.equal((await srv.api(dan, '/api/state')).status, 200);
    const danId = (await srv.api(dan, '/api/state')).json.me.userId;
    srv.sql((db) => db.prepare('DELETE FROM memberships WHERE user_id=?').run(danId));
    assert.equal((await srv.api(dan, '/api/state')).status, 401);
    assert.equal(
      srv.sql((db) => db.prepare('SELECT COUNT(*) n FROM sessions WHERE user_id=?').get(danId).n),
      0,
      'the orphaned session is deleted on use',
    );
  });

  test('FA-15 a removed parent can later set up a family of their own', async () => {
    const j = jar();
    assert.ok((await srv.signIn(j, 'google', 'bob')).ok);
    assert.equal((await srv.api(j, '/api/state')).json.setup, true);
  });
});
