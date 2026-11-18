/**
 * Evening reminders: each parent device that turned them on gets one Web Push a day, at its
 * chosen time in the family's time zone, if a child still has a challenge to mark today. The
 * message says only that it's time to mark the day: nothing about any child.
 */
const config = require('./config');
const i18n = require('./i18n');
const { today, timeOfDay } = require('./clock');
const webpush = require('./webpush');

/** Minutes since midnight for "HH:MM". */
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * Whether a subscription is due: not sent today yet, and now is within two hours after its time
 * (so a server that was down at that time doesn't wake anyone at midnight).
 */
function isDue(sub, now = new Date()) {
  const day = today(sub.timezone, now);
  if (sub.last_day === day) return false;
  const late = minutes(timeOfDay(sub.timezone, now)) - minutes(sub.time);
  return late >= 0 && late < 120;
}

function createReminders({ repo, send = webpush.send }) {
  const keys = () => repo.vapid(webpush.vapidKeys);
  const subject = config.baseUrl;

  /** One pass: sends what is due. Resolves to the number of reminders sent. */
  async function tick(now = new Date()) {
    let sent = 0;
    for (const sub of repo.allPush()) {
      if (!isDue(sub, now)) continue;
      const day = today(sub.timezone, now);
      repo.pushSent(sub.session_id, day); // once a day, sent or not
      if (!repo.unmarked(sub.family_id, day)) continue;
      const text = i18n.reminder(sub.language);
      try {
        const status = await send(
          sub,
          { title: text.title, body: text.body, url: '/' },
          keys(),
          subject,
        );
        if (status === 404 || status === 410) repo.dropPush(sub.session_id);
        else if (status >= 200 && status < 300) sent++;
        else console.warn(`A push service answered ${status}`);
      } catch (err) {
        console.warn(`A reminder could not be sent: ${err.message}`);
      }
    }
    return sent;
  }

  return { tick, publicKey: () => keys().publicKey };
}

module.exports = { createReminders, isDue };
