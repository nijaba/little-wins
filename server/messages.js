/**
 * Every user-facing string the server sends, in one place, in English. API errors also carry
 * their key here as a stable `code`, which the page translates (public/strings.<lang>.js).
 */
const LIMIT_NAMES = {
  children: 'children',
  parents: 'parents',
  items: 'behaviors, penalties and challenges',
  rewards: 'rewards',
  devices: 'devices',
  entriesPerDay: 'entries today',
};

module.exports = {
  appName: 'Little Wins',

  // Sign-in (the pages the server renders itself are in server/i18n)
  privateInstance:
    'This Little Wins is private. Ask a parent in the family for an invite link, then sign in from it.',
  tooManyTries: (seconds) => `Too many tries. Try again in ${seconds}s.`,

  // API
  login: 'login',
  viewOnly: 'view only',
  badRequest: 'bad request',
  notFound: 'not found',
  tooLarge: 'Request too large',
  jsonOnly: 'Send JSON',
  foreignOrigin: 'Request from another site refused',
  serverError: 'server error',
  nameRequired: 'A name is required',
  invalidDay: 'Invalid day',
  invalidTimeZone: 'Unknown time zone',
  invalidLanguage: 'Unknown language',
  setupDone: 'This account already has a family',
  setupNotAllowed: 'Finish signing in first',
  lastChild: 'A family needs at least one child',
  ownerOnly: 'Only the owner can do that',
  notYourself: "You can't do that to yourself",
  codeInvalid:
    "That code doesn't work. It may have expired or been used. Ask a parent for a new one.",
  limitReached: (limit) => `This family has reached its limit for ${LIMIT_NAMES[limit] || limit}.`,
  confirmFamilyName: 'Type the family name exactly to confirm.',
  operatorOnly: 'Only operators can see this',
  inviteInvalid: "This invite link doesn't work. It may have expired or been used.",
  demoOff: 'Not available in the demo',
  demoEnded: 'This demo has ended',
  demoFull:
    'Every demo family is busy right now. Grab a cup of tea and try again in a few minutes.',
  serviceFull: 'This Little Wins is full for now: it has no room for new families.',

  refusingToStart: (problems) =>
    `Refusing to start:\n- ${problems.join('\n- ')}\nSee docs/admin-guide.md.`,
};
