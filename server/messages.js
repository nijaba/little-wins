/** Every user-facing string the server sends, in one place. */
module.exports = {
  appName: 'Little Wins',
  backToApp: 'Back to Little Wins',

  // Sign-in
  unknownProvider: "That sign-in provider isn't set up here.",
  signInExpired: 'The sign-in took too long or started in another browser. Try again.',
  signInUnchecked: "The sign-in couldn't be checked. Try again.",
  providerFailed: "The sign-in provider didn't answer as expected. Try again.",
  emailNotVerified: "Google didn't confirm that this account's email is verified.",
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
  setupDone: 'This account already has a family',
  setupNotAllowed: 'Finish signing in first',
  lastChild: 'A family needs at least one child',
  ownerOnly: 'Only the owner can do that',
  notYourself: "You can't do that to yourself",
  codeInvalid:
    "That code doesn't work. It may have expired or been used. Ask a parent for a new one.",
  limitReached: (what) => `This family has reached its limit for ${what}.`,
  confirmFamilyName: 'Type the family name exactly to confirm.',
  operatorOnly: 'Only operators can see this',
  inviteInvalid: "This invite link doesn't work. It may have expired or been used.",

  refusingToStart: (problems) =>
    `Refusing to start:\n- ${problems.join('\n- ')}\nSee docs/admin-guide.md.`,
};
