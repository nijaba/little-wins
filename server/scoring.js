/**
 * Scoring rules as pure functions: dates, balance, stars, warnings, the visible week and
 * history filtering. No database access and no clock; callers pass `today` in.
 */

const fmt = (date) => date.toLocaleDateString('en-CA');
const noon = (day) => new Date(`${day}T12:00:00`);

/** Moves a YYYY-MM-DD day by n days (noon avoids daylight-saving edges). */
function shift(day, n) {
  const d = noon(day);
  d.setDate(d.getDate() + n);
  return fmt(d);
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30 etc.). */
const validDay = (day) =>
  typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && shift(day, 0) === day;

/** First day of the week containing `day`; `weekStart` is 1 for Monday (default) or 0 for Sunday. */
function startOfWeek(day, weekStart = 1) {
  const d = noon(day);
  d.setDate(d.getDate() - ((d.getDay() - weekStart + 7) % 7));
  return fmt(d);
}

/** The Monday of the week containing `day`. */
const monday = (day) => startOfWeek(day, 1);

/** One-letter day labels for a week that starts on `weekStart`. */
const dayLabels = (weekStart = 1) =>
  weekStart === 0 ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Balance from entries in time order; each point entry is clamped so it never goes below 0. */
function balance(entries) {
  let total = 0;
  for (const e of entries) if (e.kind === 'points') total = Math.max(0, total + e.points);
  return total;
}

/** Latest live mark per item and day, as { 'itemId|day': 'perfect' | 'ok' | 'bad' }. */
function latestMarks(entries) {
  const marks = {};
  for (const e of entries) if (e.kind === 'mark') marks[`${e.item_id}|${e.day}`] = e.note;
  return marks;
}

/** Perfect and bad counts per item and week, as { 'itemId|weekStartDay': { perfect, bad } }. */
function weekTotals(marks, weekStart = 1) {
  const totals = {};
  for (const key in marks) {
    const [itemId, day] = key.split('|');
    const week = `${itemId}|${startOfWeek(day, weekStart)}`;
    totals[week] ??= { perfect: 0, bad: 0 };
    if (marks[key] === 'perfect') totals[week].perfect++;
    if (marks[key] === 'bad') totals[week].bad++;
  }
  return totals;
}

/**
 * Stars across all weeks, and which items won a star in the week starting `shownWeek`.
 * A week wins a star with at least 2 perfect days and no bad day.
 */
function stars(marks, shownWeek, weekStart = 1) {
  const totals = weekTotals(marks, weekStart);
  let count = 0;
  const won = {};
  for (const week in totals) {
    if (totals[week].perfect < 2 || totals[week].bad > 0) continue;
    count++;
    const [itemId, start] = week.split('|');
    if (start === shownWeek) won[itemId] = 1;
  }
  return { stars: count, won };
}

/** Today's warning counts per item and today's mark per item. */
function todayStatus(entries, today) {
  const warn = {};
  const mk = {};
  for (const e of entries) {
    if (e.day !== today) continue;
    if (e.kind === 'warn') warn[e.item_id] = (warn[e.item_id] || 0) + 1;
    if (e.kind === 'mark') mk[e.item_id] = e.note;
  }
  return { warn, mk };
}

/**
 * Which week the Week tab shows. `requested` is any day of the wanted week (default: this
 * week). Past weeks go back to the first week with entries, and always at least one week
 * (so last Sunday can be fixed on Monday). Future weeks clamp to this week.
 */
function weekRange(today, firstEntryDay, requested, weekStart = 1) {
  const week = (day) => startOfWeek(day, weekStart);
  const thisMon = week(today);
  const minMon = [
    firstEntryDay && validDay(firstEntryDay) ? week(firstEntryDay) : thisMon,
    shift(thisMon, -7),
  ].sort()[0];
  let start = validDay(requested) ? week(requested) : thisMon;
  if (start > thisMon) start = thisMon;
  if (start < minMon) start = minMon;
  return {
    start,
    current: start === thisMon,
    prev: start > minMon ? shift(start, -7) : null,
    next: start < thisMon ? shift(start, 7) : null,
  };
}

/** Marks of each challenge for the seven days from `start`, as { itemId: [note|null x 7] }. */
function weekMarks(challenges, marks, start) {
  const days = [...Array(7)].map((_, k) => shift(start, k));
  const byItem = {};
  for (const c of challenges) byItem[c.id] = days.map((d) => marks[`${c.id}|${d}`] || null);
  return { days, marks: byItem };
}

/**
 * Milestones the app spots by itself, to cheer the child on (positive only):
 * - { kind: 'streak', days }: days in a row, up to today or yesterday, with at least one perfect
 *   mark (from 3 days);
 * - { kind: 'best' }: this week's points are already more than any earlier week's (from the
 *   third week with points).
 */
function milestones(entries, today, weekStart = 1) {
  const out = [];
  const perfect = new Set();
  for (const [key, mark] of Object.entries(latestMarks(entries)))
    if (mark === 'perfect') perfect.add(key.split('|')[1]);
  let day = perfect.has(today) ? today : shift(today, -1);
  let days = 0;
  while (perfect.has(day)) {
    days++;
    day = shift(day, -1);
  }
  if (days >= 3) out.push({ kind: 'streak', days });
  const byWeek = {};
  for (const e of entries) {
    if (e.kind !== 'points' || e.points <= 0) continue;
    const w = startOfWeek(e.day, weekStart);
    byWeek[w] = (byWeek[w] || 0) + e.points;
  }
  const now = startOfWeek(today, weekStart);
  const earlier = Object.entries(byWeek).filter(([w]) => w < now);
  if (earlier.length >= 2 && (byWeek[now] || 0) > Math.max(...earlier.map(([, p]) => p)))
    out.push({ kind: 'best' });
  return out;
}

/**
 * The weekly review for parents: the week starting `start` in detail, and the `weeks` weeks up
 * to it side by side. `entries` are one child's live entries in time order; `items` the family's.
 * Points earned and lost are the entries' own amounts (before the balance's floor at 0).
 */
function review(entries, items, start, weekStart = 1, weeks = 4) {
  const names = Object.fromEntries(items.map((i) => [i.id, i.name]));
  const marks = latestMarks(entries);
  const totals = weekTotals(marks, weekStart);
  const sum = (from, to) => {
    const t = { earned: 0, lost: 0, warnings: 0, perfectDays: 0, badDays: 0, stars: 0 };
    for (const e of entries) {
      if (e.day < from || e.day >= to) continue;
      if (e.kind === 'points' && e.points > 0) t.earned += e.points;
      if (e.kind === 'points' && e.points < 0) t.lost -= e.points;
      if (e.kind === 'warn') t.warnings++;
    }
    for (const [key, mark] of Object.entries(marks)) {
      const day = key.split('|')[1];
      if (day < from || day >= to) continue;
      if (mark === 'perfect') t.perfectDays++;
      if (mark === 'bad') t.badDays++;
    }
    for (const [key, w] of Object.entries(totals)) {
      if (key.split('|')[1] === from && w.perfect >= 2 && w.bad === 0) t.stars++;
    }
    return t;
  };
  const end = shift(start, 7);
  const days = [...Array(7)].map((_, k) => shift(start, k));
  const byDay = days.map((day) => {
    let earned = 0;
    let lost = 0;
    for (const e of entries) {
      if (e.day !== day || e.kind !== 'points') continue;
      if (e.points > 0) earned += e.points;
      else lost -= e.points;
    }
    return { day, earned, lost };
  });
  const count = (kind, positive) => {
    const by = {};
    for (const e of entries) {
      if (e.day < start || e.day >= end || e.kind !== kind) continue;
      if (positive && !(e.points > 0)) continue;
      by[e.item_id] ??= { name: names[e.item_id] ?? e.iname ?? '', times: 0, points: 0 };
      by[e.item_id].times++;
      by[e.item_id].points += e.points;
    }
    return Object.values(by).sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
  };
  const challenges = items
    .filter((i) => i.kind === 'challenge' && i.active)
    .map((c) => {
      const w = totals[`${c.id}|${start}`] || { perfect: 0, bad: 0 };
      return {
        id: c.id,
        name: c.name,
        marks: days.map((d) => marks[`${c.id}|${d}`] || null),
        won: w.perfect >= 2 && w.bad === 0,
      };
    });
  const recent = [...Array(weeks)].map((_, k) => {
    const from = shift(start, -7 * (weeks - 1 - k));
    return { start: from, ...sum(from, shift(from, 7)) };
  });
  return {
    start,
    days,
    week: sum(start, end),
    byDay,
    challenges,
    top: count('points', true).slice(0, 5),
    warnedFor: count('warn', false),
    recent,
  };
}

/**
 * The last 60 history rows, newest first. Parents see everything; the child sees only
 * positive points and never notes or marks.
 */
function history(entries, role) {
  const parent = role === 'parent';
  return entries
    .filter((e) => e.kind !== 'mark' || parent)
    .slice(-60)
    .reverse()
    .filter((e) => parent || e.points > 0)
    .map((e) => ({
      id: e.id,
      ts: e.ts,
      kind: e.kind,
      points: e.points,
      who: e.who,
      note: parent ? e.note : '',
      name: e.iname,
    }));
}

module.exports = {
  review,
  milestones,
  shift,
  validDay,
  startOfWeek,
  monday,
  dayLabels,
  balance,
  latestMarks,
  weekTotals,
  stars,
  todayStatus,
  weekRange,
  weekMarks,
  history,
};
