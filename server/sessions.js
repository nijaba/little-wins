/**
 * Per-device sessions. The cookie holds a random token; the database keeps only its SHA-256
 * hash. A session belongs to a parent (a user, possibly still setting up a family) or to a
 * child (one child of one family). Parents see and revoke a family's sessions in Settings.
 */
const crypto = require('node:crypto');
const config = require('./config');

const sha = (token) => crypto.createHash('sha256').update(token).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

/** A short device label from the User-Agent header. */
function deviceOf(req) {
  const ua = String(req.headers['user-agent'] || '');
  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}

/** Reads one cookie by name from the request. */
function readCookie(req, name) {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(req.headers.cookie || '');
  return match ? match[1] : null;
}

const sessionCookie = (token) =>
  `${config.cookies.session}=${token}; ${config.cookies.attrs}; Max-Age=${config.cookies.sessionMaxAge}`;
const clearSessionCookie = () => `${config.cookies.session}=; ${config.cookies.attrs}; Max-Age=0`;

function createSessions(db) {
  /**
   * Creates a session and returns its id and Set-Cookie value. `owner` is
   * { kind: 'parent', userId, familyId|null } or { kind: 'child', familyId, childId }.
   * Also drops sessions unused for a year.
   */
  function create(owner, req) {
    const token = randomToken(32);
    const now = new Date().toISOString();
    db.prepare('DELETE FROM sessions WHERE last_seen<?').run(
      new Date(Date.now() - config.sessionIdleMs).toISOString(),
    );
    const id = Number(
      db
        .prepare(
          'INSERT INTO sessions(token_hash,family_id,kind,user_id,child_id,device,created,last_seen) VALUES(?,?,?,?,?,?,?,?)',
        )
        .run(
          sha(token),
          owner.familyId ?? null,
          owner.kind,
          owner.userId ?? null,
          owner.childId ?? null,
          deviceOf(req),
          now,
          now,
        ).lastInsertRowid,
    );
    return { id, cookie: sessionCookie(token) };
  }

  /**
   * The session for this request, or null: { id, kind, familyId, userId, childId }.
   * A parent session whose membership has gone (removed from the family) is ended.
   */
  function auth(req) {
    const token = readCookie(req, config.cookies.session);
    if (!token || !/^[\w-]{43}$/.test(token)) return null;
    const s = db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(sha(token));
    if (!s) return null;
    if (s.kind === 'parent' && s.family_id != null) {
      const member = db
        .prepare('SELECT 1 FROM memberships WHERE family_id=? AND user_id=?')
        .get(s.family_id, s.user_id);
      if (!member) {
        db.prepare('DELETE FROM sessions WHERE id=?').run(s.id);
        return null;
      }
    } else if (s.kind === 'parent') {
      // Setting up a family, but joined one meanwhile (an invite, in another browser): use it.
      const joined = db.prepare('SELECT family_id FROM memberships WHERE user_id=?').get(s.user_id);
      if (joined) {
        db.prepare('UPDATE sessions SET family_id=? WHERE id=?').run(joined.family_id, s.id);
        s.family_id = joined.family_id;
      }
    }
    if (Date.now() - Date.parse(s.last_seen) > config.lastSeenThrottleMs) {
      db.prepare('UPDATE sessions SET last_seen=? WHERE id=?').run(new Date().toISOString(), s.id);
    }
    return {
      id: s.id,
      kind: s.kind,
      familyId: s.family_id,
      userId: s.user_id,
      childId: s.child_id,
    };
  }

  /** Attaches a family to a parent session that was setting one up. */
  function joinFamily(sessionId, familyId) {
    db.prepare('UPDATE sessions SET family_id=? WHERE id=?').run(familyId, sessionId);
  }

  function end(sessionId) {
    db.prepare('DELETE FROM sessions WHERE id=?').run(sessionId);
  }

  return { create, auth, joinFamily, end };
}

module.exports = { createSessions, sha, randomToken, deviceOf, readCookie, clearSessionCookie };
