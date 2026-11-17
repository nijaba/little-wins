/**
 * German. Same keys as en.js; anything left out falls back to English.
 * Points and stars are the same in every language; only names and notes change, in the same order.
 */
module.exports = {
  pages: {
    appName: 'Little Wins',
    backToApp: 'Zurück zu Little Wins',
    unknownProvider: 'Dieser Anmeldedienst ist hier nicht eingerichtet.',
    signInExpired:
      'Die Anmeldung hat zu lange gedauert oder wurde in einem anderen Browser gestartet. Versuch es noch einmal.',
    signInUnchecked: 'Die Anmeldung konnte nicht geprüft werden. Versuch es noch einmal.',
    providerFailed: 'Der Anmeldedienst hat nicht wie erwartet geantwortet. Versuch es noch einmal.',
    emailNotVerified: 'Google hat die E-Mail-Adresse dieses Kontos nicht als bestätigt gemeldet.',
    privateInstance:
      'Dieses Little Wins ist privat. Bitte ein Elternteil der Familie um einen Einladungslink und melde dich darüber an.',
    tooManyTries: (seconds) => `Zu viele Versuche. Versuch es in ${seconds} s noch einmal.`,
  },

  demo: { family: 'Demo-Familie', parent: 'Sam (Demo)', children: ['Mia', 'Leo'] },

  starter: {
    targets: [
      ['Morgenroutine geschafft', 'pro Routine'],
      ['Bei einer Aufgabe im Haushalt helfen', 'Punkte pro Aufgabe'],
      ['Zimmer aufräumen', 'pro Tag'],
      ['30 Min. Hausaufgaben', ''],
      ['20 Min. lesen', ''],
      ['Freundliche Worte oder eine nette Geste', 'pro Mal'],
      ['15 Min. Instrument oder Sport üben', ''],
      ['Bildschirmzeit-Regeln einhalten', 'pro Tag'],
      ['Beruhigungstrick anwenden', 'wenn aufgebracht'],
    ],
    penalties: [
      ['Jemanden schlagen oder verletzen', 'pro Vorfall'],
      ['Gemeine oder unhöfliche Worte', 'pro Vorfall'],
      ['Bildschirmzeit-Regeln gebrochen', 'pro Vorfall'],
    ],
    challenges: ['Morgenroutine', 'Freundliche Worte', 'Hausaufgaben', 'Pünktlich ins Bett'],
    rewards: [
      'Familienfilm aussuchen',
      'Abendessen wählen',
      '30 Min. mehr Bildschirmzeit',
      'Ausflug zum Spielplatz',
      'Neues Buch',
      'Ein besonderer Ausflug',
    ],
  },
};
