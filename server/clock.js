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

module.exports = { today, validTimeZone };
