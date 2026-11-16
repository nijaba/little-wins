/**
 * Builds the JSON state sent to the page for one session: the family, the selected child's
 * points, stars and week, and (for parents) the family's settings, parents and devices.
 */
const { today } = require('./clock');
const scoring = require('./scoring');

/**
 * `session` is { id, kind, familyId, userId, childId }. Parents pick a child with
 * `requestedChild` (default: the first); a child's device always shows its own child.
 */
function buildState(repo, session, { week: requestedWeek, child: requestedChild } = {}) {
  const fid = session.familyId;
  const family = repo.family(fid);
  const parent = session.kind === 'parent';
  const children = repo.children(fid);
  const selected = parent
    ? (children.find((c) => c.id === Number(requestedChild)) ?? children[0])
    : children.find((c) => c.id === session.childId);
  const cid = selected?.id;

  const items = repo.items(fid);
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
    items.filter((i) => i.kind === 'challenge'),
    marks,
    range.start,
  );
  const { stars, won } = scoring.stars(marks, range.start, weekStart);
  const { warn, mk } = scoring.todayStatus(entries, td);
  const role = parent ? 'parent' : 'child';

  const state = {
    role,
    family: { name: family.name, timezone: family.timezone, weekStart },
    // A child's device sees only its own child.
    children: parent ? children : [selected],
    childId: cid,
    childName: selected?.name || '',
    week: { days: week.days, lbl: scoring.dayLabels(weekStart), marks: week.marks, ...range },
    balance: scoring.balance(entries),
    stars,
    items: items.filter((i) => parent || i.kind !== 'penalty'),
    rewards: repo.rewards(fid),
    warn: parent ? warn : {},
    mk,
    won,
    hist: scoring.history(entries, role),
    today: td,
  };

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
