/** The only place that reads the clock for "today" (local time, YYYY-MM-DD). */
module.exports = { today: () => new Date().toLocaleDateString('en-CA') };
