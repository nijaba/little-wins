// Emails to the operator: a family signed up, the last place was taken, a parent was turned away
// because Little Wins is full (at most once a day), a family was deleted. Counts only: never a
// family's name, a parent's email or anything a family recorded. Sending never delays or fails
// the request that caused it; a failure is logged without the message.
const config = require('./config');
const { sendMail } = require('./mailer');

/**
 * repo: for familyCount. send(smtp, msg): the mailer (tests pass a fake). now(): the clock.
 * limit, site, idleDays: from the configuration unless a test passes them.
 * Returns { familyCreated(), familyDeleted(how, n), turnedAway(), idle() }, where idle() resolves
 * once every queued email was tried (tests).
 */
function createAlerts({
  repo,
  notify = config.notify,
  send = sendMail,
  now = () => new Date(),
  limit = config.familyLimit,
  site = config.baseUrl,
  idleDays = config.idleFamilyDays,
}) {
  let queue = Promise.resolve();
  let turnedAwayDay = null;

  const counts = () => {
    const n = repo.familyCount();
    return { n, of: limit == null ? `${n}` : `${n} of ${limit}` };
  };
  const holds = (n) =>
    `It now holds ${n} ${n === 1 ? 'family' : 'families'}${limit == null ? '' : ` (limit ${limit})`}.`;

  function mail(event, subject, lines) {
    if (!notify?.events.has(event)) return;
    const text = [...lines, '', `-- Little Wins at ${site}`].join('\n');
    queue = queue
      .then(() => send(notify.smtp, { to: notify.to, subject: `Little Wins: ${subject}`, text }))
      .catch((err) => console.warn(`Could not send the "${event}" email: ${err.message}`));
  }

  function familyCreated() {
    const { n, of } = counts();
    mail('signup', `a new family signed up (${of})`, [
      `A new family just signed up on ${site}.`,
      holds(n),
    ]);
    if (limit != null && n === limit) {
      mail('full', `full (${of})`, [
        `The last place was just taken: Little Wins holds ${n} of ${limit} families.`,
        'New parents now see "Ask for a place" instead of setting up a family.',
        'To make room, raise LIMIT_FAMILIES in .env and restart.',
      ]);
    }
  }

  function familyDeleted(how, count = 1) {
    const { n, of } = counts();
    const what =
      how === 'idle'
        ? `${count} ${count === 1 ? 'family was' : 'families were'} deleted after ${idleDays} days without use.`
        : 'A family was deleted by its owner.';
    mail('deleted', `${count === 1 ? 'a family was' : `${count} families were`} deleted (${of})`, [
      what,
      holds(n),
    ]);
  }

  function turnedAway() {
    const day = now().toISOString().slice(0, 10);
    if (turnedAwayDay === day) return;
    turnedAwayDay = day;
    const { of } = counts();
    mail('turned-away', `a parent was turned away (${of})`, [
      `A parent tried to set up a family while Little Wins was full (${of}).`,
      'You get at most one such email a day.',
    ]);
  }

  return { familyCreated, familyDeleted, turnedAway, idle: () => queue };
}

module.exports = { createAlerts };
