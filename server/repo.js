/**
 * The family-scoped data layer. Every function takes the family ID first and every statement
 * filters on it; IDs that come from a request are only ever used together with that family ID,
 * so another family's IDs behave like IDs that don't exist. Routes never write SQL themselves.
 */
const config = require('./config');
const { seedStarter } = require('./db');
const { sha, randomToken } = require('./sessions');

const now = () => new Date().toISOString();

// One-time device codes: 10 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
function newCode() {
  // randomInt is uniform (no modulo bias, which `byte % 31` would have).
  const { randomInt } = require('node:crypto');
  return Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
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

  function updateFamily(fid, { name, timezone, weekStart, language }) {
    db.prepare('UPDATE families SET name=?, timezone=?, week_start=?, language=? WHERE id=?').run(
      name,
      timezone,
      weekStart,
      language,
      fid,
    );
  }

  /** Creates a family with its owner and first child; optionally the starter list, in its language. */
  function createFamily({
    name,
    timezone,
    weekStart = 1,
    language = 'en',
    ownerId,
    childName,
    starter,
  }) {
    return tx(() => {
      const fid = Number(
        db
          .prepare(
            'INSERT INTO families(name,timezone,week_start,language,created,last_active) VALUES(?,?,?,?,?,?)',
          )
          .run(name, timezone, weekStart, language, now(), now()).lastInsertRowid,
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
      if (starter) seedStarter(db, fid, language);
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
      `INSERT INTO users(provider,subject,email,login,domain,name,created,last_seen) VALUES(?,?,?,?,?,?,?,?)
       ON CONFLICT(provider,subject) DO UPDATE SET email=excluded.email, login=excluded.login,
       domain=excluded.domain, name=excluded.name, last_seen=excluded.last_seen`,
    ).run(
      identity.provider,
      identity.subject,
      identity.email ?? null,
      identity.login ?? null,
      identity.domain ?? null,
      identity.name,
      t,
      t,
    );
    return db
      .prepare('SELECT * FROM users WHERE provider=? AND subject=?')
      .get(identity.provider, identity.subject);
  }

  const user = (userId) => db.prepare('SELECT id, name FROM users WHERE id=?').get(userId) ?? null;

  /** A user as an identity for allowlist checks: { provider, email, login, domain }. */
  const identityOf = (userId) =>
    db.prepare('SELECT provider, email, login, domain FROM users WHERE id=?').get(userId) ?? null;

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

  // --- Family invites (operator, SIGNUP_MODE=invite) ----------------------------------------
  // Installation-wide like the operator's counts: no family ID to scope them by. Only the
  // operator routes and sign-in reach them.
  function createFamilyInvite(userId, ms) {
    const token = randomToken(24);
    const expires = new Date(Date.now() + ms).toISOString();
    db.prepare(
      'INSERT INTO family_invites(token_hash,created_by,created,expires) VALUES(?,?,?,?)',
    ).run(sha(token), userId, now(), expires);
    return { token, expires };
  }

  /** Invites not used yet and not expired, oldest first. */
  const familyInvites = () =>
    db
      .prepare(
        'SELECT id, created, expires FROM family_invites WHERE used_at IS NULL AND expires>? ORDER BY id',
      )
      .all(now());

  const revokeFamilyInvite = (id) =>
    db.prepare('DELETE FROM family_invites WHERE id=? AND used_at IS NULL').run(id).changes > 0;

  /** A usable family invite by its token (not used, not expired), or null. */
  const findFamilyInvite = (token) =>
    typeof token === 'string' && token.length >= 16
      ? (db
          .prepare(
            'SELECT id FROM family_invites WHERE token_hash=? AND used_at IS NULL AND expires>?',
          )
          .get(sha(token), now()) ?? null)
      : null;

  /** Uses an invite up for this parent; true when it was still free. */
  const useFamilyInvite = (inviteId, userId) =>
    db
      .prepare('UPDATE family_invites SET used_by=?, used_at=? WHERE id=? AND used_at IS NULL')
      .run(userId, now(), inviteId).changes > 0;

  /** Whether this parent holds a used invite whose family is not created yet. */
  const holdsFamilyInvite = (userId) =>
    !!db.prepare('SELECT 1 FROM family_invites WHERE used_by=? AND family_id IS NULL').get(userId);

  /** Marks the parent's invite as spent on the family they just created. */
  const spendFamilyInvite = (userId, fid) =>
    db
      .prepare(
        'UPDATE family_invites SET family_id=? WHERE id=(SELECT id FROM family_invites WHERE used_by=? AND family_id IS NULL ORDER BY id LIMIT 1)',
      )
      .run(fid, userId);

  /** How many real families the installation holds (for LIMIT_FAMILIES). */
  const familyCount = () => db.prepare('SELECT COUNT(*) n FROM families').get().n;

  /**
   * Deletes families no device has used since `before` (an ISO time), with everything they own.
   * Families without parents (unclaimed, migrated data) wait for their owner and are kept.
   * Returns how many were deleted.
   */
  function deleteIdleFamilies(before) {
    const ids = db
      .prepare(
        `SELECT f.id FROM families f WHERE COALESCE(f.last_active, f.created) < ?
           AND EXISTS (SELECT 1 FROM memberships m WHERE m.family_id = f.id)`,
      )
      .all(before)
      .map((r) => r.id);
    for (const fid of ids) deleteFamily(fid);
    return ids.length;
  }

  /** True when LIMIT_FAMILIES is set and reached: no new family can be created. */
  const familiesFull = () => config.familyLimit != null && familyCount() >= config.familyLimit;

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

  /** Records an entry; `ts` defaults to now (the demo's made-up history passes past times). */
  function addEntry(fid, cid, { itemId, kind, points, note, day, userId, who, ts }) {
    db.prepare(
      'INSERT INTO entries(family_id,child_id,item_id,kind,points,note,day,ts,user_id,who) VALUES(?,?,?,?,?,?,?,?,?,?)',
    ).run(fid, cid, itemId, kind, points, note || '', day, ts || now(), userId ?? null, who);
  }

  /** Replaces a child's mark for an item and day. */
  function replaceMark(fid, cid, itemId, day, mark, userId, who, ts) {
    tx(() => {
      db.prepare(
        "UPDATE entries SET undone=1 WHERE family_id=? AND child_id=? AND kind='mark' AND item_id=? AND day=?",
      ).run(fid, cid, itemId, day);
      addEntry(fid, cid, { itemId, kind: 'mark', points: 0, note: mark, day, userId, who, ts });
    });
  }

  const undoEntry = (fid, id) =>
    db.prepare('UPDATE entries SET undone=1 WHERE family_id=? AND id=?').run(fid, id).changes > 0;
  /** Sets a parent's note on points or a warning (a mark's `note` holds the mark itself). */
  const setNote = (fid, id, note) =>
    db
      .prepare("UPDATE entries SET note=? WHERE family_id=? AND id=? AND kind IN ('points','warn')")
      .run(note, fid, id).changes > 0;

  // --- Encouragement: one message per child -------------------------------------------------
  /** Sets (or, with an empty text, clears) a child's message; false when the child isn't here. */
  function setMessage(fid, cid, text, userId, who) {
    if (!child(fid, cid)) return false;
    db.prepare('DELETE FROM messages WHERE family_id=? AND child_id=?').run(fid, cid);
    if (text) {
      db.prepare(
        'INSERT INTO messages(child_id,family_id,text,user_id,who,created) VALUES(?,?,?,?,?,?)',
      ).run(cid, fid, text, userId, who, now());
    }
    return true;
  }

  const message = (fid, cid) =>
    db
      .prepare('SELECT text, who, created FROM messages WHERE family_id=? AND child_id=?')
      .get(fid, cid) ?? null;

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

  /**
   * Uses a code once: returns { familyId, childId }, or null if unknown, used or expired.
   * `accept(familyId)` may refuse (e.g. the family is at its device limit): then the code is
   * left unused and { familyId, refused: true } is returned.
   */
  function redeemPairing(code, accept = () => true) {
    const normalized = normalizeCode(code);
    if (normalized.length !== 10) return null;
    return tx(() => {
      const p = db
        .prepare('SELECT * FROM pairings WHERE code_hash=? AND used_at IS NULL AND expires>?')
        .get(sha(normalized), now());
      if (!p) return null;
      if (!accept(p.family_id)) return { familyId: p.family_id, refused: true };
      db.prepare('UPDATE pairings SET used_at=? WHERE id=?').run(now(), p.id);
      return { familyId: p.family_id, childId: p.child_id };
    });
  }

  // --- Change tracking, limits, export, deletion, operator counts ------------------------------
  /** Marks a family as changed (its state's ETag changes). */
  const bump = (fid) => {
    if (fid != null) db.prepare('UPDATE families SET version=version+1 WHERE id=?').run(fid);
  };

  /** How many of something a family has, for the per-family limits. */
  function count(fid, what, day) {
    const sql = {
      children: 'SELECT COUNT(*) n FROM children WHERE family_id=?',
      parents: 'SELECT COUNT(*) n FROM memberships WHERE family_id=?',
      items: 'SELECT COUNT(*) n FROM items WHERE family_id=? AND active=1',
      rewards: 'SELECT COUNT(*) n FROM rewards WHERE family_id=?',
      devices: 'SELECT COUNT(*) n FROM sessions WHERE family_id=?',
      entriesPerDay: 'SELECT COUNT(*) n FROM entries WHERE family_id=? AND day=?',
    }[what];
    return db.prepare(sql).get(...(what === 'entriesPerDay' ? [fid, day] : [fid])).n;
  }

  /** Everything a family has, for the owner to download. No tokens or hashes. */
  function exportFamily(fid) {
    const f = family(fid);
    return {
      format: 'little-wins-export',
      version: 1,
      exported: now(),
      family: { name: f.name, timezone: f.timezone, weekStart: f.week_start, created: f.created },
      parents: parents(fid).map((p) => ({
        name: p.name,
        provider: p.provider,
        account: p.label,
        role: p.role,
      })),
      children: db
        .prepare('SELECT id, name, created FROM children WHERE family_id=? ORDER BY sort, id')
        .all(fid),
      items: db
        .prepare(
          'SELECT id, kind, name, note, pmin, pmax, active FROM items WHERE family_id=? ORDER BY sort, id',
        )
        .all(fid),
      rewards: db
        .prepare('SELECT id, name, stars, points FROM rewards WHERE family_id=? ORDER BY sort, id')
        .all(fid),
      entries: db
        .prepare(
          `SELECT id, child_id, item_id, kind, points, note, day, ts, who, undone FROM entries
           WHERE family_id=? ORDER BY ts, id`,
        )
        .all(fid),
      messages: db
        .prepare(
          'SELECT child_id, text, who, created FROM messages WHERE family_id=? ORDER BY child_id',
        )
        .all(fid),
    };
  }

  /**
   * Deletes a family and everything in it (rows cascade). Parents who belong to no other
   * family are deleted too, so no account details are kept for them.
   */
  function deleteFamily(fid) {
    return tx(() => {
      const userIds = db
        .prepare('SELECT user_id FROM memberships WHERE family_id=?')
        .all(fid)
        .map((r) => r.user_id);
      db.prepare('DELETE FROM families WHERE id=?').run(fid);
      const drop = db.prepare(
        'DELETE FROM users WHERE id=? AND NOT EXISTS (SELECT 1 FROM memberships WHERE user_id=?)',
      );
      for (const id of userIds) drop.run(id, id);
      return true;
    });
  }

  /** Aggregate numbers for the operator page. Never names or content. */
  function operatorStats() {
    const n = (sql, ...args) => db.prepare(sql).get(...args).n;
    const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
    return {
      families: n('SELECT COUNT(*) n FROM families'),
      unclaimedFamilies: n(
        'SELECT COUNT(*) n FROM families f WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.family_id=f.id)',
      ),
      parents: n('SELECT COUNT(*) n FROM memberships'),
      children: n('SELECT COUNT(*) n FROM children'),
      devices: n('SELECT COUNT(*) n FROM sessions'),
      activeDevices30d: n('SELECT COUNT(*) n FROM sessions WHERE last_seen>?', monthAgo),
      entries: n('SELECT COUNT(*) n FROM entries'),
      dbBytes: db
        .prepare('SELECT page_count * page_size AS n FROM pragma_page_count(), pragma_page_size()')
        .get().n,
    };
  }

  return {
    tx,
    bump,
    count,
    exportFamily,
    deleteFamily,
    operatorStats,
    createFamilyInvite,
    familyInvites,
    revokeFamilyInvite,
    findFamilyInvite,
    useFamilyInvite,
    holdsFamilyInvite,
    spendFamilyInvite,
    familyCount,
    familiesFull,
    deleteIdleFamilies,
    identityOf,
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
    setMessage,
    message,
    setNote,
    sessions,
    revokeSession,
    createPairing,
    redeemPairing,
  };
}

module.exports = { createRepo, normalizeCode, CODE_ALPHABET };
