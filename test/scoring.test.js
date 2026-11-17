// Unit tests for server/scoring.js: pure functions, no server and no database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const s = require('../server/scoring');

const points = (p) => ({ kind: 'points', points: p });
const mark = (item_id, day, note) => ({ kind: 'mark', item_id, day, note });

test('SC-01 shift moves across months, years and leap days', () => {
  assert.equal(s.shift('2026-01-31', 1), '2026-02-01');
  assert.equal(s.shift('2026-01-01', -1), '2025-12-31');
  assert.equal(s.shift('2028-02-28', 1), '2028-02-29');
  assert.equal(s.shift('2026-02-28', 1), '2026-03-01');
  assert.equal(s.shift('2026-06-15', 0), '2026-06-15');
  assert.equal(s.shift('2026-03-01', -7), '2026-02-22');
});

test('SC-02 validDay accepts real dates only', () => {
  assert.equal(s.validDay('2026-02-28'), true);
  assert.equal(s.validDay('2028-02-29'), true, 'leap day');
  assert.equal(s.validDay('2026-02-29'), false, 'not a leap year');
  assert.equal(s.validDay('2026-02-30'), false);
  assert.equal(s.validDay('2026-13-01'), false);
  assert.equal(s.validDay('2026-1-5'), false);
  assert.equal(s.validDay('garbage'), false);
  assert.equal(s.validDay(null), false);
  assert.equal(s.validDay(20260105), false);
});

test('SC-03 monday finds the start of the week for every weekday', () => {
  // 2026-11-16 is a Monday.
  const week = [
    '2026-11-16',
    '2026-11-17',
    '2026-11-18',
    '2026-11-19',
    '2026-11-20',
    '2026-11-21',
    '2026-11-22',
  ];
  for (const day of week) assert.equal(s.monday(day), '2026-11-16', day);
  assert.equal(s.monday('2026-11-23'), '2026-11-23', 'the next Monday starts a new week');
});

test('SC-04 monday works across a year boundary', () => {
  assert.equal(s.monday('2027-01-01'), '2026-12-28'); // a Friday
  assert.equal(s.monday('2026-12-28'), '2026-12-28');
  assert.equal(s.monday('2028-01-02'), '2027-12-27'); // a Sunday
});

test('SC-05 balance clamps at 0 in time order', () => {
  assert.equal(s.balance([]), 0);
  assert.equal(s.balance([points(5), points(10)]), 15);
  assert.equal(s.balance([points(-50)]), 0, 'a penalty on an empty balance costs nothing');
  assert.equal(s.balance([points(-50), points(5)]), 5, 'so it costs nothing later either');
  assert.equal(s.balance([points(5), points(-50)]), 0);
  assert.equal(s.balance([points(5), points(-50), points(10)]), 10, 'order matters');
  assert.equal(s.balance([points(10), points(-3), points(5)]), 12);
  assert.equal(
    s.balance([{ kind: 'warn', points: 0 }, mark(1, '2026-11-16', 'perfect')]),
    0,
    'only points count',
  );
});

test('SC-06 latestMarks keeps the last mark per item and day', () => {
  const m = s.latestMarks([
    mark(1, '2026-11-16', 'ok'),
    mark(1, '2026-11-16', 'perfect'),
    mark(2, '2026-11-16', 'bad'),
  ]);
  assert.deepEqual(m, { '1|2026-11-16': 'perfect', '2|2026-11-16': 'bad' });
});

test('SC-07 weekTotals counts perfect and bad days per item and week', () => {
  const t = s.weekTotals({
    '1|2026-11-16': 'perfect',
    '1|2026-11-18': 'bad',
    '1|2026-11-23': 'perfect',
    '2|2026-11-17': 'ok',
  });
  assert.deepEqual(t, {
    '1|2026-11-16': { perfect: 1, bad: 1 },
    '1|2026-11-23': { perfect: 1, bad: 0 },
    '2|2026-11-16': { perfect: 0, bad: 0 },
  });
});

test('SC-08 stars: 2 perfect days and no bad day win a star', () => {
  const week = '2026-11-16';
  const two = { '1|2026-11-16': 'perfect', '1|2026-11-18': 'perfect' };
  assert.deepEqual(s.stars(two, week), { stars: 1, won: { 1: 1 } });
  assert.deepEqual(
    s.stars({ '1|2026-11-16': 'perfect', '1|2026-11-17': 'ok' }, week),
    { stars: 0, won: {} },
    'one perfect day',
  );
  assert.equal(
    s.stars({ ...two, '1|2026-11-19': 'bad' }, week).stars,
    0,
    'a bad day cancels the star',
  );
  assert.equal(s.stars({ ...two, '1|2026-11-19': 'ok' }, week).stars, 1, 'ok days do not');
  assert.equal(
    s.stars({ ...two, '1|2026-11-20': 'perfect' }, week).stars,
    1,
    'three perfect days is still one star',
  );
});

test('SC-09 stars: weeks and items count separately', () => {
  const marks = {
    '1|2026-11-16': 'perfect',
    '1|2026-11-23': 'perfect', // one perfect day in each of two weeks: no star
    '2|2026-11-16': 'perfect',
    '2|2026-11-17': 'perfect', // item 2 wins in the week of 11-16
    '3|2026-11-23': 'perfect',
    '3|2026-11-24': 'perfect', // item 3 wins in the week of 11-23
  };
  assert.deepEqual(s.stars(marks, '2026-11-16'), { stars: 2, won: { 2: 1 } });
  assert.deepEqual(s.stars(marks, '2026-11-23'), { stars: 2, won: { 3: 1 } });
  assert.deepEqual(s.stars(marks, '2026-11-30'), { stars: 2, won: {} });
});

test('SC-10 todayStatus counts warnings and reads marks for today only', () => {
  const entries = [
    { kind: 'warn', item_id: 1, day: '2026-11-16' },
    { kind: 'warn', item_id: 1, day: '2026-11-16' },
    { kind: 'warn', item_id: 1, day: '2026-11-15' },
    { kind: 'warn', item_id: 2, day: '2026-11-16' },
    mark(3, '2026-11-16', 'ok'),
    mark(3, '2026-11-16', 'perfect'),
    mark(4, '2026-11-15', 'bad'),
    { kind: 'points', item_id: 5, day: '2026-11-16', points: 5 },
  ];
  assert.deepEqual(s.todayStatus(entries, '2026-11-16'), {
    warn: { 1: 2, 2: 1 },
    mk: { 3: 'perfect' },
  });
});

test('SC-11 weekRange: default, future and early weeks clamp', () => {
  const today = '2026-11-18'; // Wednesday; this week starts 2026-11-16
  const first = '2026-10-05'; // a Monday
  const thisWeek = { start: '2026-11-16', current: true, prev: '2026-11-09', next: null };
  assert.deepEqual(s.weekRange(today, first, null), thisWeek);
  assert.deepEqual(s.weekRange(today, first, 'garbage'), thisWeek);
  assert.deepEqual(s.weekRange(today, first, '2099-01-05'), thisWeek, 'future clamps to this week');
  assert.deepEqual(s.weekRange(today, first, '2026-11-12'), {
    start: '2026-11-09',
    current: false,
    prev: '2026-11-02',
    next: '2026-11-16',
  });
  assert.deepEqual(
    s.weekRange(today, first, '2020-01-01'),
    {
      start: '2026-10-05',
      current: false,
      prev: null,
      next: '2026-10-12',
    },
    'before the first entry clamps to its week',
  );
});

test('SC-12 weekRange: with no entries you can still go back one week', () => {
  const r = s.weekRange('2026-11-16', null, '2020-01-01'); // a Monday
  assert.deepEqual(r, { start: '2026-11-09', current: false, prev: null, next: '2026-11-16' });
  assert.equal(s.weekRange('2026-11-16', null, null).prev, '2026-11-09');
});

test('SC-13 weekRange: a recent first entry still allows one week back; invalid first day is ignored', () => {
  assert.equal(s.weekRange('2026-11-18', '2026-11-17', null).prev, '2026-11-09');
  assert.equal(s.weekRange('2026-11-18', 'not a day', '2020-01-01').start, '2026-11-09');
});

test("SC-14 weekMarks lists seven days and each challenge's marks", () => {
  const marks = {
    '1|2026-11-17': 'perfect',
    '1|2026-11-22': 'bad',
    '2|2026-11-16': 'ok',
    '3|2026-11-23': 'perfect',
  };
  const w = s.weekMarks([{ id: 1 }, { id: 2 }], marks, '2026-11-16');
  assert.deepEqual(w.days, [
    '2026-11-16',
    '2026-11-17',
    '2026-11-18',
    '2026-11-19',
    '2026-11-20',
    '2026-11-21',
    '2026-11-22',
  ]);
  assert.deepEqual(w.marks[1], [null, 'perfect', null, null, null, null, 'bad']);
  assert.deepEqual(w.marks[2], ['ok', null, null, null, null, null, null]);
  assert.equal(w.marks[3], undefined);
});

test('SC-15 history: parents see everything, the child only positive points without notes', () => {
  const e = (id, kind, points, note) => ({
    id,
    ts: `t${id}`,
    kind,
    points,
    who: 'Parent',
    note,
    iname: `item${id}`,
  });
  const entries = [
    e(1, 'points', 5, 'a'),
    e(2, 'points', -50, 'b'),
    e(3, 'warn', 0, 'c'),
    e(4, 'mark', 0, 'perfect'),
    e(5, 'points', 10, 'd'),
  ];
  const parent = s.history(entries, 'parent');
  assert.deepEqual(
    parent.map((h) => h.id),
    [5, 4, 3, 2, 1],
    'newest first',
  );
  assert.deepEqual(parent[3], {
    id: 2,
    ts: 't2',
    kind: 'points',
    points: -50,
    who: 'Parent',
    note: 'b',
    name: 'item2',
  });
  const child = s.history(entries, 'child');
  assert.deepEqual(
    child.map((h) => h.id),
    [5, 1],
  );
  assert.ok(child.every((h) => h.note === '' && h.points > 0));
});

test('SC-16 history keeps the last 60 entries', () => {
  const entries = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    kind: 'points',
    points: 5,
    note: '',
  }));
  const h = s.history(entries, 'parent');
  assert.equal(h.length, 60);
  assert.equal(h[0].id, 100);
  assert.equal(h.at(-1).id, 41);
});

test('SC-17 startOfWeek with a Sunday start finds the Sunday for every weekday', () => {
  // 2026-11-15 is a Sunday.
  const week = [
    '2026-11-15',
    '2026-11-16',
    '2026-11-17',
    '2026-11-18',
    '2026-11-19',
    '2026-11-20',
    '2026-11-21',
  ];
  for (const day of week) assert.equal(s.startOfWeek(day, 0), '2026-11-15', day);
  assert.equal(s.startOfWeek('2026-11-22', 0), '2026-11-22', 'the next Sunday starts a new week');
  assert.equal(s.startOfWeek('2027-01-01', 0), '2026-12-27', 'across a year boundary');
});

test('SC-18 startOfWeek defaults to Monday and agrees with monday()', () => {
  assert.equal(s.startOfWeek('2026-11-22'), '2026-11-16');
  assert.equal(s.startOfWeek('2026-11-22', 1), s.monday('2026-11-22'));
  assert.equal(s.startOfWeek('2026-11-15', 1), '2026-11-09', 'a Sunday belongs to the Monday week');
});

test('SC-19 dayLabels start with the first day of the week', () => {
  assert.deepEqual(s.dayLabels(1), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  assert.deepEqual(s.dayLabels(), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  assert.deepEqual(s.dayLabels(0), ['S', 'M', 'T', 'W', 'T', 'F', 'S']);
});

test('SC-20 stars: a Sunday-start week groups Sunday with the days after it', () => {
  const marks = { '1|2026-11-15': 'perfect', '1|2026-11-16': 'perfect' }; // Sunday + Monday
  assert.equal(s.stars(marks, '2026-11-15', 1).stars, 0, 'Monday weeks split them');
  const sunday = s.stars(marks, '2026-11-15', 0);
  assert.equal(sunday.stars, 1, 'Sunday weeks keep them together');
  assert.equal(sunday.won[1], 1);
});

test('SC-21 weekRange with a Sunday start begins on Sunday and clamps like Monday weeks', () => {
  const r = s.weekRange('2026-11-18', '2026-10-07', null, 0); // Wednesday; first entry a Wednesday
  assert.deepEqual(r, { start: '2026-11-15', current: true, prev: '2026-11-08', next: null });
  const past = s.weekRange('2026-11-18', '2026-10-07', '2020-01-01', 0);
  assert.deepEqual([past.start, past.prev], ['2026-10-04', null]);
});

test('SC-22 review sums one week and the weeks before it, and counts what was done most often', () => {
  const items = [
    { id: 1, kind: 'target', name: 'Reading', active: 1 },
    { id: 2, kind: 'target', name: 'Tidy room', active: 1 },
    { id: 3, kind: 'penalty', name: 'Rude words', active: 1 },
    { id: 9, kind: 'challenge', name: 'Bedtime', active: 1 },
    { id: 8, kind: 'challenge', name: 'Old one', active: 0 },
  ];
  const e = (kind, item_id, day, extra = {}) => ({ kind, item_id, day, points: 0, ...extra });
  const entries = [
    e('points', 1, '2026-11-02', { points: 5 }), // the week before
    e('mark', 9, '2026-11-02', { note: 'perfect' }),
    e('mark', 9, '2026-11-03', { note: 'perfect' }),
    e('points', 1, '2026-11-09', { points: 5 }),
    e('points', 1, '2026-11-10', { points: 5 }),
    e('points', 2, '2026-11-10', { points: 10 }),
    e('points', 3, '2026-11-11', { points: -15 }),
    e('warn', 2, '2026-11-11'),
    e('warn', 2, '2026-11-12'),
    e('mark', 9, '2026-11-09', { note: 'perfect' }),
    e('mark', 9, '2026-11-10', { note: 'bad' }),
    e('mark', 9, '2026-11-10', { note: 'perfect' }), // fixed: the latest mark counts
    e('mark', 9, '2026-11-12', { note: 'ok' }),
    e('points', 1, '2026-11-16', { points: 5 }), // the week after: not counted
  ];
  const r = s.review(entries, items, '2026-11-09', 1, 2);
  assert.deepEqual(r.week, {
    earned: 20,
    lost: 15,
    warnings: 2,
    perfectDays: 2,
    badDays: 0,
    stars: 1,
  });
  assert.equal(r.days.length, 7);
  assert.deepEqual(r.byDay[1], { day: '2026-11-10', earned: 15, lost: 0 });
  assert.deepEqual(r.byDay[2], { day: '2026-11-11', earned: 0, lost: 15 });
  assert.deepEqual(r.challenges, [
    {
      id: 9,
      name: 'Bedtime',
      marks: ['perfect', 'perfect', null, 'ok', null, null, null],
      won: true,
    },
  ]);
  assert.deepEqual(r.top, [
    { name: 'Reading', times: 2, points: 10 },
    { name: 'Tidy room', times: 1, points: 10 },
  ]);
  assert.deepEqual(r.warnedFor, [{ name: 'Tidy room', times: 2, points: 0 }]);
  assert.deepEqual(
    r.recent.map((w) => [w.start, w.earned, w.stars]),
    [
      ['2026-11-02', 5, 1],
      ['2026-11-09', 20, 1],
    ],
  );
  const empty = s.review([], items, '2026-11-09');
  assert.equal(empty.recent.length, 4, 'four weeks by default');
  assert.deepEqual(empty.top, []);
});
