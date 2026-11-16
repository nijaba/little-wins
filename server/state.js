/** Builds the JSON state object sent to the page, from the database via scoring.js. */
const { today } = require('./clock');
const scoring = require('./scoring');

function buildState(db, role, sid, requestedWeek) {
  const items = db.prepare('SELECT * FROM items WHERE active=1 ORDER BY sort').all();
  const entries = db
    .prepare(
      'SELECT e.*,i.name iname FROM entries e LEFT JOIN items i ON i.id=e.item_id WHERE undone=0 ORDER BY ts,id',
    )
    .all();
  const td = today();
  const firstDay = db.prepare('SELECT MIN(day) d FROM entries').get().d;
  const setting = db.prepare('SELECT value FROM settings WHERE key=?').get('child_name');

  const marks = scoring.latestMarks(entries);
  const range = scoring.weekRange(td, firstDay, requestedWeek);
  const week = scoring.weekMarks(
    items.filter((i) => i.kind === 'challenge'),
    marks,
    range.start,
  );
  const { stars, won } = scoring.stars(marks, range.start);
  const { warn, mk } = scoring.todayStatus(entries, td);
  const parent = role === 'parent';

  return {
    childName: setting?.value || '',
    week: {
      days: week.days,
      lbl: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      marks: week.marks,
      ...range,
    },
    role,
    balance: scoring.balance(entries),
    stars,
    items: items.filter((i) => parent || i.kind !== 'penalty'),
    rewards: db.prepare('SELECT * FROM rewards ORDER BY sort,id').all(),
    warn,
    mk,
    won,
    hist: scoring.history(entries, role),
    today: td,
    devices: parent
      ? db
          .prepare(
            'SELECT id,role,device,created,last_seen FROM sessions ORDER BY last_seen DESC,id DESC',
          )
          .all()
          .map((d) => ({ ...d, me: d.id === sid }))
      : undefined,
  };
}

module.exports = { buildState };
