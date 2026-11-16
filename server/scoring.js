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
