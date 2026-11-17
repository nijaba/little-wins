/**
 * Notices on a child's device: when a parent's action newly unlocks a reward for the child,
 * completes a streak of perfect days, or makes this week their best, the child's devices that
 * turned notices on get one Web Push. Each notice is sent once (child_notices), so undoing and
 * redoing an entry doesn't send it again. Only good news; never penalties or warnings.
 */
const i18n = require('./i18n');
const scoring = require('./scoring');
const { today } = require('./clock');
const webpush = require('./webpush');
const config = require('./config');

function createNotices({ repo, send = webpush.send }) {
  /** What is true for the child now, as notice keys mapped to their text. */
  function snapshot(fid, cid) {
    const family = repo.family(fid);
    const td = today(family.timezone);
    const entries = repo.entries(fid, cid);
    const marks = scoring.latestMarks(entries);
    const stars = scoring.stars(marks, td, family.week_start).stars;
    const balance = scoring.balance(entries);
    const text = i18n.notice(family.language);
    const now = {};
    for (const r of repo.rewards(fid)) {
      if (r.for !== null && !r.for.includes(cid)) continue;
      if (stars >= r.stars && balance >= r.points) now[`reward:${r.id}`] = text.reward(r.name);
    }
    for (const m of scoring.milestones(entries, td, family.week_start)) {
      if (m.kind === 'streak') now[`streak:${scoring.shift(td, 1 - m.days)}`] = text.streak(m.days);
      if (m.kind === 'best') now[`best:${scoring.startOfWeek(td, family.week_start)}`] = text.best;
    }
    return now;
  }

  /** Before a parent's action: what was true, or null when this child gets no notices. */
  function before(fid, cid) {
    const c = repo.child(fid, cid);
    if (!c?.notify || !repo.childPush(fid, cid).length) return null;
    return snapshot(fid, cid);
  }

  /** After it: sends what newly became true, once each. Resolves to the number sent. */
  async function after(fid, cid, was) {
    if (!was) return 0;
    const fresh = Object.entries(snapshot(fid, cid)).filter(
      ([key]) => !(key in was) && repo.noticeOnce(fid, cid, key),
    );
    if (!fresh.length) return 0;
    const keys = repo.vapid(webpush.vapidKeys);
    let sent = 0;
    for (const sub of repo.childPush(fid, cid)) {
      for (const [, body] of fresh) {
        try {
          const status = await send(
            sub,
            { title: 'Little Wins', body, url: '/' },
            keys,
            config.baseUrl,
          );
          if (status === 404 || status === 410) repo.dropPush(sub.session_id);
          else if (status >= 200 && status < 300) sent++;
        } catch (err) {
          console.warn(`A notice could not be sent: ${err.message}`);
        }
      }
    }
    return sent;
  }

  return { before, after };
}

module.exports = { createNotices };
