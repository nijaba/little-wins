/** The only place that reads the clock for "today": YYYY-MM-DD in the given IANA time zone. */
const today = (timeZone = 'UTC') => new Date().toLocaleDateString('en-CA', { timeZone });

/** Is this a time zone the runtime knows (e.g. "America/Chicago", "UTC")? */
function validTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The time of day, HH:MM (24-hour), in the given IANA time zone. */
const timeOfDay = (timeZone = 'UTC', now = new Date()) =>
  now.toLocaleTimeString('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

module.exports = { today, timeOfDay, validTimeZone };
