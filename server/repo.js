/**
 * The family-scoped data layer. Every function takes the family ID first and every statement
 * filters on it; IDs that come from a request are only ever used together with that family ID,
 * so another family's IDs behave like IDs that don't exist. Routes never write SQL themselves.
 */
const { seedStarter } = require('./db');
const { sha, randomToken } = require('./sessions');

const now = () => new Date().toISOString();

// One-time device codes: 10 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function newCode() {
  const bytes = require('node:crypto').randomBytes(10);
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
/** Normalizes a typed code: upper case, no spaces or dashes. */
const normalizeCode = (code) =>
  String(code || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');

function createRepo(db) {
  const tx = (fn) => {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  // --- Families -------------------------------------------------------------------------
  const family = (fid) => db.prepare('SELECT * FROM families WHERE id=?').get(fid);

  function updateFamily(fid, { name, timezone, weekStart }) {
    db.prepare('UPDATE families SET name=?, timezone=?, week_start=? WHERE id=?').run(
      name,
      timezone,
      weekStart,
      fid,
    );
  }

  /** Creates a family with its owner and first child; optionally the starter list. */
  function createFamily({ name, timezone, weekStart = 1, ownerId, childName, starter }) {
    return tx(() => {
      const fid = Number(
        db
          .prepare('INSERT INTO families(name,timezone,week_start,created) VALUES(?,?,?,?)')
          .run(name, timezone, weekStart, now()).lastInsertRowid,
      );
      db.prepare('INSERT INTO memberships(family_id,user_id,role,created) VALUES(?,?,?,?)').run(
        fid,
        ownerId,
        'owner',
        now(),
      );
      db.prepare('INSERT INTO children(family_id,name,sort,created) VALUES(?,?,0,?)').run(
        fid,
        childName,
        now(),
      );
      if (starter) seedStarter(db, fid);
      return fid;
    });
  }

  /** The oldest family with no parents (data migrated from a single-family install), if any. */
  const unclaimedFamily = () =>
    db
      .prepare(
        'SELECT f.id FROM families f WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.family_id=f.id) ORDER BY f.id LIMIT 1',
      )
      .get()?.id ?? null;

  // --- Parents --------------------------------------------------------------------------
  /** Creates or refreshes a user from a sign-in identity; returns the user row. */
  function upsertUser(identity) {
    const t = now();
    db.prepare(
      `INSERT INTO users(provider,subject,email,login,name,created,last_seen) VALUES(?,?,?,?,?,?,?)
       ON CONFLICT(provider,subject) DO UPDATE SET email=excluded.email, login=excluded.login,
       name=excluded.name, last_seen=excluded.last_seen`,
    ).run(
      identity.provider,
      identity.subject,
      identity.email ?? null,
      identity.login ?? null,
      identity.name,
      t,
      t,
    );
    return db
      .prepare('SELECT * FROM users WHERE provider=? AND subject=?')
      .get(identity.provider, identity.subject);
  }

  const user = (userId) => db.prepare('SELECT id, name FROM users WHERE id=?').get(userId) ?? null;

  const membershipOf = (userId) =>
    db.prepare('SELECT family_id, role FROM memberships WHERE user_id=?').get(userId) ?? null;

  const role = (fid, userId) =>
    db.prepare('SELECT role FROM memberships WHERE family_id=? AND user_id=?').get(fid, userId)
      ?.role ?? null;

  function addMember(fid, userId, memberRole) {
    db.prepare('INSERT INTO memberships(family_id,user_id,role,created) VALUES(?,?,?,?)').run(
      fid,
      userId,
      memberRole,
      now(),
    );
  }

  const parents = (fid) =>
    db
      .prepare(
        `SELECT u.id, u.name, u.provider, COALESCE(u.email, u.login) AS label, m.role
         FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.family_id=? ORDER BY m.created, u.id`,
      )
      .all(fid);

  /** Removes a parent (not the owner) and ends their sessions in this family. */
  function removeParent(fid, userId) {
    return tx(() => {
      const r = db
        .prepare("DELETE FROM memberships WHERE family_id=? AND user_id=? AND role='parent'")
        .run(fid, userId);
      db.prepare("DELETE FROM sessions WHERE family_id=? AND user_id=? AND kind='parent'").run(
        fid,
        userId,
      );
      return r.changes > 0;
    });
  }

  /** Hands ownership to another parent of the same family; the old owner stays a parent. */
  function transferOwner(fid, fromUserId, toUserId) {
    return tx(() => {
      const to = db
        .prepare(
          "UPDATE memberships SET role='owner' WHERE family_id=? AND user_id=? AND role='parent'",
        )
        .run(fid, toUserId);
      if (!to.changes) return false;
      db.prepare("UPDATE memberships SET role='parent' WHERE family_id=? AND user_id=?").run(
        fid,
        fromUserId,
      );
      return true;
    });
  }

  // --- Invites (co-parents) ---------------------------------------------------------------
  function createInvite(fid, userId, ms) {
    const token = randomToken(24);
    const expires = new Date(Date.now() + ms).toISOString();
    db.prepare(
      'INSERT INTO invites(family_id,token_hash,created_by,created,expires) VALUES(?,?,?,?,?)',
    ).run(fid, sha(token), userId, now(), expires);
    return { token, expires };
  }

  const invites = (fid) =>
    db
      .prepare(
        'SELECT id, created, expires FROM invites WHERE family_id=? AND used_at IS NULL AND expires>? ORDER BY id',
      )
      .all(fid, now());

  const revokeInvite = (fid, id) =>
    db.prepare('DELETE FROM invites WHERE family_id=? AND id=?').run(fid, id).changes > 0;

  /** A usable invite by its token (not used, not expired), with the family name. */
  const findInvite = (token) =>
    typeof token === 'string' && token.length >= 16
      ? (db
          .prepare(
            `SELECT i.id, i.family_id, f.name AS family_name FROM invites i JOIN families f ON f.id=i.family_id
             WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires>?`,
          )
          .get(sha(token), now()) ?? null)
      : null;

  const useInvite = (inviteId) =>
    db.prepare('UPDATE invites SET used_at=? WHERE id=? AND used_at IS NULL').run(now(), inviteId)
      .changes > 0;

  // --- Children -----------------------------------------------------------------------------
  const children = (fid) =>
    db.prepare('SELECT id, name FROM children WHERE family_id=? ORDER BY sort, id').all(fid);

  const child = (fid, cid) =>
    db.prepare('SELECT id, name FROM children WHERE family_id=? AND id=?').get(fid, cid) ?? null;

  function addChild(fid, name) {
    const sort = db
      .prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM children WHERE family_id=?')
      .get(fid).s;
    return Number(
      db
        .prepare('INSERT INTO children(family_id,name,sort,created) VALUES(?,?,?,?)')
        .run(fid, name, sort, now()).lastInsertRowid,
    );
  }

  const renameChild = (fid, cid, name) =>
    db.prepare('UPDATE children SET name=? WHERE family_id=? AND id=?').run(name, fid, cid)
      .changes > 0;

  /** Deletes a child with their history, devices and codes. Never the last child. */
  function deleteChild(fid, cid) {
    if (children(fid).length <= 1) return false;
    return db.prepare('DELETE FROM children WHERE family_id=? AND id=?').run(fid, cid).changes > 0;
  }

  // --- Behaviors, penalties, challenges -------------------------------------------------------
  const items = (fid) =>
    db.prepare('SELECT * FROM items WHERE family_id=? AND active=1 ORDER BY sort, id').all(fid);

  const item = (fid, id) =>
    db.prepare('SELECT * FROM items WHERE family_id=? AND id=?').get(fid, id) ?? null;

  function saveItem(fid, { id, kind, name, note, pmin, pmax }) {
    if (id) {
      return (
        db
          .prepare(
            'UPDATE items SET name=?,note=?,pmin=?,pmax=? WHERE family_id=? AND id=? AND kind=? AND active=1',
          )
          .run(name, note, pmin, pmax, fid, id, kind).changes > 0
      );
    }
    const sort = db
      .prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM items WHERE family_id=?')
      .get(fid).s;
    db.prepare(
      'INSERT INTO items(family_id,kind,name,note,pmin,pmax,sort,active) VALUES(?,?,?,?,?,?,?,1)',
    ).run(fid, kind, name, note, pmin, pmax, sort);
    return true;
  }

  /** Hides an item; its history stays. */
  const deleteItem = (fid, id) =>
    db.prepare('UPDATE items SET active=0 WHERE family_id=? AND id=?').run(fid, id).changes > 0;

  // --- Rewards ------------------------------------------------------------------------------
  const rewards = (fid) =>
    db
      .prepare(
        'SELECT id, name, stars, points, sort FROM rewards WHERE family_id=? ORDER BY sort, id',
      )
      .all(fid);

  function saveReward(fid, { id, name, stars, points }) {
    if (id) {
      return (
        db
          .prepare('UPDATE rewards SET name=?,stars=?,points=? WHERE family_id=? AND id=?')
          .run(name, stars, points, fid, id).changes > 0
      );
    }
    const sort = db
      .prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM rewards WHERE family_id=?')
      .get(fid).s;
    db.prepare('INSERT INTO rewards(family_id,name,stars,points,sort) VALUES(?,?,?,?,?)').run(
      fid,
      name,
      stars,
      points,
      sort,
    );
    return true;
  }

  const deleteReward = (fid, id) =>
    db.prepare('DELETE FROM rewards WHERE family_id=? AND id=?').run(fid, id).changes > 0;

  /** Moves an item (within its kind) or a reward one place up (dir < 0) or down. */
  function move(fid, table, id, dir) {
    const list =
      table === 'rewards'
        ? db.prepare('SELECT id FROM rewards WHERE family_id=? ORDER BY sort, id').all(fid)
        : (() => {
            const row = item(fid, id);
            if (!row) return [];
            return db
              .prepare(
                'SELECT id FROM items WHERE family_id=? AND active=1 AND kind=? ORDER BY sort, id',
              )
              .all(fid, row.kind);
          })();
    const from = list.findIndex((x) => x.id === id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= list.length) return;
    list.splice(to, 0, list.splice(from, 1)[0]);
    const update = db.prepare(
      `UPDATE ${table === 'rewards' ? 'rewards' : 'items'} SET sort=? WHERE family_id=? AND id=?`,
    );
    tx(() => {
      list.forEach((x, k) => {
        update.run(k + 1, fid, x.id);
      });
    });
  }

  // --- Entries (per child) ----------------------------------------------------------------------
  /** A child's live entries in time order, with item names. */
  const entries = (fid, cid) =>
    db
      .prepare(
        `SELECT e.*, i.name AS iname FROM entries e LEFT JOIN items i ON i.id=e.item_id AND i.family_id=e.family_id
         WHERE e.family_id=? AND e.child_id=? AND e.undone=0 ORDER BY e.ts, e.id`,
      )
      .all(fid, cid);

  const firstEntryDay = (fid, cid) =>
    db.prepare('SELECT MIN(day) d FROM entries WHERE family_id=? AND child_id=?').get(fid, cid).d;

  function addEntry(fid, cid, { itemId, kind, points, note, day, userId, who }) {
    db.prepare(
      'INSERT INTO entries(family_id,child_id,item_id,kind,points,note,day,ts,user_id,who) VALUES(?,?,?,?,?,?,?,?,?,?)',
    ).run(fid, cid, itemId, kind, points, note || '', day, now(), userId ?? null, who);
  }

  /** Replaces a child's mark for an item and day. */
  function replaceMark(fid, cid, itemId, day, mark, userId, who) {
    tx(() => {
      db.prepare(
        "UPDATE entries SET undone=1 WHERE family_id=? AND child_id=? AND kind='mark' AND item_id=? AND day=?",
      ).run(fid, cid, itemId, day);
      addEntry(fid, cid, { itemId, kind: 'mark', points: 0, note: mark, day, userId, who });
    });
  }

  const undoEntry = (fid, id) =>
    db.prepare('UPDATE entries SET undone=1 WHERE family_id=? AND id=?').run(fid, id).changes > 0;

  // --- Devices --------------------------------------------------------------------------------
  const sessions = (fid) =>
    db
      .prepare(
        `SELECT s.id, s.kind, s.device, s.created, s.last_seen, s.user_id, s.child_id,
                COALESCE(u.name, c.name) AS who
         FROM sessions s LEFT JOIN users u ON u.id=s.user_id LEFT JOIN children c ON c.id=s.child_id
         WHERE s.family_id=? ORDER BY s.last_seen DESC, s.id DESC`,
      )
      .all(fid);

  const revokeSession = (fid, id) =>
    db.prepare('DELETE FROM sessions WHERE family_id=? AND id=?').run(fid, id).changes > 0;

  /** A one-time code that pairs a device to one child. Returns the code and when it expires. */
  function createPairing(fid, cid, userId, ms) {
    const code = newCode();
    const expires = new Date(Date.now() + ms).toISOString();
    db.prepare(
      'INSERT INTO pairings(family_id,child_id,code_hash,created_by,created,expires) VALUES(?,?,?,?,?,?)',
    ).run(fid, cid, sha(code), userId, now(), expires);
    return { code, expires };
  }

  /** Uses a code once: returns { familyId, childId } or null if unknown, used or expired. */
  function redeemPairing(code) {
    const normalized = normalizeCode(code);
    if (normalized.length !== 10) return null;
    return tx(() => {
      const p = db
        .prepare('SELECT * FROM pairings WHERE code_hash=? AND used_at IS NULL AND expires>?')
        .get(sha(normalized), now());
      if (!p) return null;
      db.prepare('UPDATE pairings SET used_at=? WHERE id=?').run(now(), p.id);
      return { familyId: p.family_id, childId: p.child_id };
    });
  }

  return {
    tx,
    family,
    updateFamily,
    createFamily,
    unclaimedFamily,
    upsertUser,
    user,
    membershipOf,
    role,
    addMember,
    parents,
    removeParent,
    transferOwner,
    createInvite,
    invites,
    revokeInvite,
    findInvite,
    useInvite,
    children,
    child,
    addChild,
    renameChild,
    deleteChild,
    items,
    item,
    saveItem,
    deleteItem,
    rewards,
    saveReward,
    deleteReward,
    move,
    entries,
    firstEntryDay,
    addEntry,
    replaceMark,
    undoEntry,
    sessions,
    revokeSession,
    createPairing,
    redeemPairing,
  };
}

module.exports = { createRepo, normalizeCode, CODE_ALPHABET };
