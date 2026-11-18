/**
 * Builds the JSON state sent to the page for one session: the family, the selected child's
 * points, stars and week, and (for parents) the family's settings, parents and devices.
 */
const config = require('./config');
const { today } = require('./clock');
const scoring = require('./scoring');

/**
 * `session` is { id, kind, familyId, userId, childId }. Parents pick a child with
 * `requestedChild` (default: the first); a child's device always shows its own child.
 * `demo` is set for a demo family (server/demo.js).
 */
function buildState(
  repo,
  session,
  { week: requestedWeek, child: requestedChild } = {},
  demo = null,
) {
  const fid = session.familyId;
  const family = repo.family(fid);
  const parent = session.kind === 'parent';
  const children = repo.children(fid);
  const selected = parent
    ? (children.find((c) => c.id === Number(requestedChild)) ?? children[0])
    : children.find((c) => c.id === session.childId);
  const cid = selected?.id;

  const items = repo.items(fid);
  // Items and rewards can be for some children only (`for`: null = everyone).
  const applies = (r) => r.for === null || r.for.includes(cid);
  const entries = cid ? repo.entries(fid, cid) : [];
  const td = today(family.timezone);
  const weekStart = family.week_start;

  const marks = scoring.latestMarks(entries);
  const range = scoring.weekRange(
    td,
    cid ? repo.firstEntryDay(fid, cid) : null,
    requestedWeek,
    weekStart,
  );
  const week = scoring.weekMarks(
    items.filter((i) => i.kind === 'challenge' && applies(i)),
    marks,
    range.start,
  );
  const { stars, won } = scoring.stars(marks, range.start, weekStart);
  const { warn, mk } = scoring.todayStatus(entries, td);
  const role = parent ? 'parent' : 'child';
  // A child's device may show the emoji that child picked (the hidden picker), when allowed.
  const own = !parent && selected?.own_emoji ? repo.childEmoji(fid, cid) : null;
  const itemOf = new Map(own ? entries.map((e) => [e.id, e.item_id]) : []);
  const mineEmoji = (kind) => (r) =>
    own?.[kind][r.id] ? { ...r, emoji: own[kind][r.id], picked: true } : r;

  const state = {
    role,
    family: { name: family.name, timezone: family.timezone, weekStart, language: family.language },
    // A child's device sees only its own child.
    children: parent ? children : [selected],
    childId: cid,
    childName: selected?.name || '',
    week: { days: week.days, lbl: scoring.dayLabels(weekStart), marks: week.marks, ...range },
    balance: scoring.balance(entries),
    stars,
    // Parents get the whole list (Settings edits it; the page shows the chosen child's part);
    // a child's device gets only what is for that child, and never penalties.
    items: parent
      ? items
      : items.filter((i) => i.kind !== 'penalty' && applies(i)).map(mineEmoji('item')),
    rewards: parent
      ? repo.rewards(fid)
      : repo.rewards(fid).filter(applies).map(mineEmoji('reward')),
    warn: parent ? warn : {},
    mk,
    won,
    hist: own
      ? scoring.history(entries, role).map((e) => {
          const pick = own.item[itemOf.get(e.id)];
          return pick ? { ...e, emoji: pick } : e;
        })
      : scoring.history(entries, role),
    today: td,
    // Points earned today (positive entries only), for the child's Today.
    todayPoints: entries
      .filter((e) => e.day === td && e.kind === 'points' && e.points > 0)
      .reduce((sum, e) => sum + e.points, 0),
    milestones: scoring.milestones(entries, td, weekStart),
  };

  if (own) state.ownEmoji = true;

  // A parent's encouraging message to this child, shown for 7 days or until replaced.
  const msg = cid ? repo.message(fid, cid) : null;
  if (msg && Date.now() - Date.parse(msg.created) < 7 * 864e5) state.message = msg;

  // A demo family: the banner gives its idle time.
  if (demo) state.demo = { idleSeconds: demo.idleSeconds };
  // Parents are told how long an unused family is kept (DELETE_IDLE_FAMILIES_DAYS).
  else if (parent && config.idleFamilyDays) state.idleDays = config.idleFamilyDays;

  if (parent) {
    const myRole = repo.role(fid, session.userId);
    state.me = { userId: session.userId, owner: myRole === 'owner' };
    state.parents = repo.parents(fid).map((p) => ({ ...p, me: p.id === session.userId }));
    state.invites = repo.invites(fid);
    state.devices = repo.sessions(fid).map((d) => ({
      id: d.id,
      kind: d.kind,
      device: d.device,
      who: d.who || '',
      created: d.created,
      last_seen: d.last_seen,
      me: d.id === session.id,
    }));
  }
  return state;
}

module.exports = { buildState };
