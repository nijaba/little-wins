/**
 * Français. Same keys as en.js; anything left out falls back to English.
 * Points and stars are the same in every language; only names and notes change.
 */
module.exports = {
  pages: {
    appName: 'Little Wins',
    backToApp: 'Retour à Little Wins',
    askForPlace: 'Demander une place',
    unknownProvider: 'Ce fournisseur de connexion n’est pas configuré ici.',
    signInExpired:
      'La connexion a pris trop de temps ou a commencé dans un autre navigateur. Réessaie.',
    signInUnchecked: 'La connexion n’a pas pu être vérifiée. Réessaie.',
    providerFailed: 'Le fournisseur de connexion n’a pas répondu comme prévu. Réessaie.',
    emailNotVerified: 'Google n’a pas confirmé que l’adresse e-mail de ce compte est vérifiée.',
    privateInstance:
      'Ce Little Wins est privé. Demande un lien d’invitation à un parent de la famille, puis connecte-toi depuis ce lien.',
    tooManyTries: (seconds) => `Trop d’essais. Réessaie dans ${seconds} s.`,
  },

  // Notices on a child's device (server/notices.js): good news only.
  notice: {
    reward: (name) => `⭐ Tu as débloqué ${name} !`,
    streak: (n) => `🔥 ${n} jours parfaits d'affilée !`,
    best: "🏅 Ta meilleure semaine jusqu'ici !",
  },
  // The evening reminder (server/reminders.js), as the phone shows it.
  reminder: { title: 'Little Wins', body: "C'est l'heure de noter les défis du jour." },

  demo: {
    family: 'Famille de démo',
    parent: 'Sam (démo)',
    children: ['Mia', 'Léo'],
    message: 'Bravo pour ton aide au dîner hier. Je suis fier de toi !',
  },

  starter: {
    // [name, note]
    targets: [
      ['Routine du matin terminée', 'par routine'],
      ['Aider à une tâche de la maison', 'points par tâche'],
      ['Ranger sa chambre', 'par jour'],
      ['Devoirs 30 min', ''],
      ['Lecture 20 min', ''],
      ['Paroles ou gestes gentils', 'par occasion'],
      ['Pratiquer un instrument ou un sport 15 min', ''],
      ['Respecter les règles d’écran', 'par jour'],
      ['Utiliser une astuce pour se calmer', 'quand ça ne va pas'],
    ],
    penalties: [
      ['Frapper ou faire mal à quelqu’un', 'par incident'],
      ['Paroles méchantes ou impolies', 'par incident'],
      ['Ne pas respecter les règles d’écran', 'par incident'],
    ],
    challenges: ['Routine du matin', 'Paroles gentilles', 'Devoirs', 'Coucher à l’heure'],
    rewards: [
      'Choisir le film en famille',
      'Choisir le dîner',
      '30 min d’écran en plus',
      'Sortie au parc',
      'Un nouveau livre',
      'Une journée spéciale',
    ],
  },
};
