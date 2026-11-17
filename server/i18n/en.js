/**
 * English: the base language. Other files in this folder translate the same keys; anything a
 * translation leaves out falls back to this file.
 *
 * - `pages`: text of the few pages the server renders itself (sign-in problems).
 * - `starter`: the sample list a new family can start with. Points and stars are the same in
 *   every language; translations change only the names and notes, keeping the order.
 */
module.exports = {
  pages: {
    appName: 'Little Wins',
    backToApp: 'Back to Little Wins',
    unknownProvider: "That sign-in provider isn't set up here.",
    signInExpired: 'The sign-in took too long or started in another browser. Try again.',
    signInUnchecked: "The sign-in couldn't be checked. Try again.",
    providerFailed: "The sign-in provider didn't answer as expected. Try again.",
    emailNotVerified: "Google didn't confirm that this account's email is verified.",
    privateInstance:
      'This Little Wins is private. Ask a parent in the family for an invite link, then sign in from it.',
    tooManyTries: (seconds) => `Too many tries. Try again in ${seconds}s.`,
  },

  starter: {
    // [name, note] — points come from STARTER_POINTS in index.js, in the same order.
    targets: [
      ['Morning routine done', 'per routine'],
      ['Help with a family chore', 'points per chore'],
      ['Tidy room', 'per day'],
      ['Homework 30 min', ''],
      ['Reading 20 min', ''],
      ['Kind words or a kind gesture', 'per occasion'],
      ['Practice an instrument or sport 15 min', ''],
      ['Follow screen-time rules', 'per day'],
      ['Use a calming strategy', 'when upset'],
    ],
    penalties: [
      ['Hitting or hurting someone', 'per incident'],
      ['Unkind or rude words', 'per incident'],
      ['Breaking screen-time rules', 'per incident'],
    ],
    challenges: ['Morning routine', 'Kind words', 'Homework', 'Bedtime on time'],
    rewards: [
      'Pick the family movie',
      'Choose dinner',
      'Extra 30 min screen time',
      'Trip to the park',
      'New book',
      'A special day out',
    ],
  },
};
