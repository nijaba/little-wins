/**
 * Per-device sessions and the PIN lockout. The cookie holds a random token; the database
 * keeps only its SHA-256 hash. A parent can see and revoke each device in Settings.
 */
const crypto = require('node:crypto');
const config = require('./config');

const sha = (token) => crypto.createHash('sha256').update(token).digest('hex');

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

function createSessions(db) {
  /** Creates a session; returns its id and the Set-Cookie value. Also drops year-old sessions. */
  function newSession(role, req) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date().toISOString();
    db.prepare('DELETE FROM sessions WHERE last_seen<?').run(
      new Date(Date.now() - config.sessionIdleMs).toISOString(),
    );
    const id = Number(
      db
        .prepare('INSERT INTO sessions(token_hash,role,device,created,last_seen) VALUES(?,?,?,?,?)')
        .run(sha(token), role, deviceOf(req), now, now).lastInsertRowid,
    );
    const cookie = `${config.cookieName}=${token}; ${config.cookieAttrs}; Max-Age=${config.cookieMaxAge}`;
    return { id, cookie };
  }

  /** Looks up the session from the cookie: { role, sid } or null. */
  function auth(req) {
    const match = /(?:^|;\s*)t=([^;]*)/.exec(req.headers.cookie || '');
    if (!match || !/^[\w-]{43}$/.test(match[1])) return null;
    const session = db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(sha(match[1]));
    if (!session) return null;
    if (Date.now() - Date.parse(session.last_seen) > config.lastSeenThrottleMs) {
      db.prepare('UPDATE sessions SET last_seen=? WHERE id=?').run(
        new Date().toISOString(),
        session.id,
      );
    }
    return { role: session.role, sid: session.id };
  }

  return { newSession, auth };
}

/** Global PIN lockout: `remaining(now)` is the seconds left (0 if open), then fail() / reset(). */
function createLockout() {
  const { freeTries, baseMs, maxMs } = config.lockout;
  const lock = { fails: 0, until: 0 };
  return {
    remaining: (now) => (now < lock.until ? Math.ceil((lock.until - now) / 1000) : 0),
    fail(now) {
      lock.fails++;
      if (lock.fails >= freeTries) {
        lock.until = now + Math.min(maxMs, baseMs * 2 ** (lock.fails - freeTries));
      }
    },
    reset() {
      lock.fails = 0;
    },
  };
}

module.exports = { createSessions, createLockout, sha, deviceOf };
