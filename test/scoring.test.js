// Unit tests for server/scoring.js: pure functions, no server and no database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const s = require('../server/scoring');

const points = (p) => ({ kind: 'points', points: p });
const mark = (item_id, day, note) => ({ kind: 'mark', item_id, day, note });

test('shift moves across months, years and leap days', () => {
  assert.equal(s.shift('2026-01-31', 1), '2026-02-01');
  assert.equal(s.shift('2026-01-01', -1), '2025-12-31');
  assert.equal(s.shift('2028-02-28', 1), '2028-02-29');
  assert.equal(s.shift('2026-02-28', 1), '2026-03-01');
  assert.equal(s.shift('2026-06-15', 0), '2026-06-15');
  assert.equal(s.shift('2026-03-01', -7), '2026-02-22');
});

test('validDay accepts real dates only', () => {
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

test('monday finds the start of the week for every weekday', () => {
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

test('monday works across a year boundary', () => {
  assert.equal(s.monday('2027-01-01'), '2026-12-28'); // a Friday
  assert.equal(s.monday('2026-12-28'), '2026-12-28');
  assert.equal(s.monday('2028-01-02'), '2027-12-27'); // a Sunday
});

test('balance clamps at 0 in time order', () => {
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

test('latestMarks keeps the last mark per item and day', () => {
  const m = s.latestMarks([
    mark(1, '2026-11-16', 'ok'),
    mark(1, '2026-11-16', 'perfect'),
    mark(2, '2026-11-16', 'bad'),
  ]);
  assert.deepEqual(m, { '1|2026-11-16': 'perfect', '2|2026-11-16': 'bad' });
});

test('weekTotals counts perfect and bad days per item and week', () => {
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

test('stars: 2 perfect days and no bad day win a star', () => {
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

test('stars: weeks and items count separately', () => {
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

test('todayStatus counts warnings and reads marks for today only', () => {
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

test('weekRange: default, future and early weeks clamp', () => {
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

test('weekRange: with no entries you can still go back one week', () => {
  const r = s.weekRange('2026-11-16', null, '2020-01-01'); // a Monday
  assert.deepEqual(r, { start: '2026-11-09', current: false, prev: null, next: '2026-11-16' });
  assert.equal(s.weekRange('2026-11-16', null, null).prev, '2026-11-09');
});

test('weekRange: a recent first entry still allows one week back; invalid first day is ignored', () => {
  assert.equal(s.weekRange('2026-11-18', '2026-11-17', null).prev, '2026-11-09');
  assert.equal(s.weekRange('2026-11-18', 'not a day', '2020-01-01').start, '2026-11-09');
});

test("weekMarks lists seven days and each challenge's marks", () => {
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

test('history: parents see everything, the child only positive points without notes', () => {
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

test('history keeps the last 60 entries', () => {
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
