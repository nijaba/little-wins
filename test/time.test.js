// Per-family time zone and week start.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { shift } = require('../server/scoring');
const { startServer, item } = require('./helpers');

let srv;
before(async () => {
  srv = await startServer({ signup: 'open' });
});
after(() => srv.close());

const dayIn = (timeZone) => new Date().toLocaleDateString('en-CA', { timeZone });
const dow = (day) => new Date(`${day}T12:00:00`).getDay();

test("each family's today follows its own time zone", async () => {
  const east = await srv.newFamily({ tz: 'Pacific/Kiritimati' }); // UTC+14
  const west = await srv.newFamily({ tz: 'Etc/GMT+12' }); // UTC-12
  assert.equal(east.state.today, dayIn('Pacific/Kiritimati'));
  assert.equal(west.state.today, dayIn('Etc/GMT+12'));
  assert.notEqual(east.state.today, west.state.today, 'they are a day or more apart');
  const kid = await srv.pairChild(east.jar, east.childId);
  assert.equal((await srv.api(kid.jar, '/api/state')).json.today, east.state.today, 'children too');
});

test('changing the time zone changes today', async () => {
  const f = await srv.newFamily({ tz: 'Etc/GMT+12' });
  const r = await srv.api(f.jar, '/api/family/save', {
    name: 'Moved',
    timezone: 'Pacific/Kiritimati',
  });
  assert.equal(r.json.today, dayIn('Pacific/Kiritimati'));
});

test('a week that starts on Sunday has Sunday first and labels starting with S', async () => {
  const sun = await srv.newFamily({ weekStart: 0 });
  const mon = await srv.newFamily({ weekStart: 1 });
  assert.equal(dow(sun.state.week.days[0]), 0);
  assert.deepEqual(sun.state.week.lbl, ['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  assert.equal(dow(mon.state.week.days[0]), 1);
  assert.deepEqual(mon.state.week.lbl, ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  assert.ok(sun.state.week.days.includes(sun.state.today));
  assert.equal(sun.state.week.days[6], shift(sun.state.week.days[0], 6));
});

test('the week start can be changed in Settings and previous weeks follow it', async () => {
  const f = await srv.newFamily({ weekStart: 1 });
  const r = await srv.api(f.jar, '/api/family/save', {
    name: 'Sundays',
    timezone: 'UTC',
    week_start: 0,
  });
  assert.equal(dow(r.json.week.days[0]), 0);
  assert.equal(dow(r.json.week.prev), 0);
  assert.equal(r.json.week.prev, shift(r.json.week.start, -7));
});

test('marks on a day that is still in the future in the family time zone are refused', async () => {
  const east = await srv.newFamily({ tz: 'Pacific/Kiritimati' });
  const west = await srv.newFamily({ tz: 'Etc/GMT+12' });
  const eastToday = east.state.today;
  assert.ok(eastToday > west.state.today, 'Kiritimati is ahead');
  const mark = (f, day) =>
    srv.api(f.jar, '/api/mark', {
      child_id: f.childId,
      item_id: item(f.state, 'challenge').id,
      mark: 'perfect',
      day,
    });
  assert.equal((await mark(east, eastToday)).status, 200, 'today there');
  assert.equal((await mark(west, eastToday)).status, 400, 'tomorrow for the family behind');
  assert.equal((await mark(west, west.state.today)).status, 200);
  assert.equal((await mark(east, shift(eastToday, 1))).status, 400);
});

test('new entries are dated in the family time zone', async () => {
  const f = await srv.newFamily({ tz: 'Pacific/Kiritimati' });
  const t = item(f.state, 'target');
  await srv.api(f.jar, '/api/add', { child_id: f.childId, item_id: t.id });
  const days = srv.sql((db) =>
    db
      .prepare('SELECT day FROM entries')
      .all()
      .map((e) => e.day),
  );
  assert.ok(days.includes(dayIn('Pacific/Kiritimati')));
});
