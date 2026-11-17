// French strings for the page. Same keys as strings.en.js; missing keys fall back to English.
window.LW_STRINGS = window.LW_STRINGS || {};
window.LW_STRINGS.fr = {
  appName: 'Little Wins',
  // BCP 47 locale for dates and numbers (Intl).
  locale: 'fr',

  // Bottom tabs: [icon, label]
  tabs: {
    today: ['☀️', 'Aujourd’hui'],
    week: ['⭐', 'Semaine'],
    rew: ['🏆', 'Récompenses'],
    hist: ['🕘', 'Historique'],
    set: ['⚙️', 'Réglages'],
  },

  // Header and shared bits
  header: (balance, stars) => `${balance} pts · ${stars} ★`,
  pts: 'pts',
  ptsRange: (a, b) => `${a}-${b} pts`,
  star: '★',

  // Signed-out screen, invite and setup
  login: {
    signInWith: { google: 'Se connecter avec Google', github: 'Se connecter avec GitHub' },
    parentsOnly: 'Pour les parents',
    codeTitle: 'Utiliser un code d’un parent',
    codeHelp: 'Sur l’appareil d’un enfant, saisis le code créé par un parent dans les Réglages.',
    codePlaceholder: 'ABCD-EFGH-JK',
    codeButton: 'Connecter cet appareil',
    codeFailed: 'Ce code n’a pas fonctionné. Demande-en un nouveau à un parent.',
    joinTitle: (family) => `Rejoindre ${family}`,
    joinHelp: 'Connecte-toi pour rejoindre cette famille en tant que parent.',
    inviteInvalid:
      'Ce lien d’invitation ne fonctionne pas. Il a peut-être expiré ou déjà été utilisé.',
    notNow: 'Plus tard',
    networkError: 'Impossible de joindre le serveur. Réessaie.',
    familyDeleted: 'Famille supprimée.',
  },
  legal: { privacy: 'Confidentialité', terms: 'Conditions' },
  operator: {
    title: 'Opérateur',
    help: 'Des chiffres sur cette installation. Le contenu des familles n’est jamais affiché ici.',
    loading: 'Chargement…',
    refresh: 'Actualiser',
    failed: 'Impossible de charger les chiffres. Réessaie.',
    families: 'Familles',
    unclaimedFamilies: 'Familles non réclamées',
    parents: 'Parents',
    children: 'Enfants',
    devices: 'Appareils',
    activeDevices30d: 'Appareils actifs (30 jours)',
    entries: 'Entrées',
    dbSize: 'Taille de la base de données',
    mb: (n) => `${n} Mo`,
    version: 'Version',
    uptime: 'Durée de fonctionnement',
    duration: (s) => {
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
    },
  },
  setup: {
    title: 'Configure ta famille',
    hello: (name) => `Bienvenue, ${name}.`,
    familyName: 'Nom de la famille',
    childName: 'Prénom du premier enfant',
    timeZone: 'Fuseau horaire',
    weekStart: 'La semaine commence le',
    monday: 'Lundi',
    sunday: 'Dimanche',
    starter: 'Commencer avec une liste d’exemples de comportements et de récompenses',
    language: 'Langue',
    create: 'Créer',
    private:
      'Ce Little Wins est privé. Demande un lien d’invitation à un parent de la famille, puis connecte-toi depuis ce lien.',
    signOut: 'Se déconnecter',
  },

  // Toast and history descriptions
  undo: 'Annuler',
  undoLower: 'annuler',
  warningPrefix: '⚠ Avertissement · ',

  // Next-reward ring
  ring: {
    allUnlocked: '🎉 Tout est débloqué !',
    next: 'Prochaine récompense',
    pts: 'pts',
  },

  // Celebration overlay
  party: {
    unlocked: 'Récompense débloquée !',
  },

  // Today tab
  today: {
    earn: 'Gagner des points',
    waysToEarn: 'Comment gagner des points',
    penalties: 'Pénalités',
    promptPoints: (min, max) => `Points (${min}-${max})`,
    confirmPenalty: (name) => `Enregistrer la pénalité : ${name} ?`,
    warnButton: (n) => `⚠${n}/2`,
  },

  // Week tab
  week: {
    prevLabel: 'Semaine précédente',
    nextLabel: 'Semaine suivante',
    thisWeek: 'Cette semaine',
    weekOf: (d) => `Semaine du ${d}`,
    starsWon: (n) => ` · ${n} ★ gagnée${n > 1 ? 's' : ''}`,
    back: 'Retour à cette semaine',
    challenges: 'Défis de la semaine',
    rule: 'Gagne une ★ avec au moins 2 jours parfaits et aucun mauvais jour dans la semaine.',
    ruleParent: ' Touche un jour pour choisir ✓ parfait, ~ correct ou ✗ mauvais.',
    won: '★ gagnée',
    perfectDays: (n) => `${n}/2 jours parfaits`,
    aBadDay: ' · un mauvais jour',
    marks: { perfect: '✓', ok: '~', bad: '✗', none: '·' },
  },

  // Rewards tab
  rewards: {
    title: 'Récompenses',
    unlocked: '✅ débloquée',
    pointsPlus: (n) => `+ ${n} pts`,
  },

  // History tab
  history: {
    title: 'Historique',
    warning: '⚠ avertissement',
    mark: 'note : ',
    // Challenge marks, by name
    markNames: { perfect: 'parfait', ok: 'correct', bad: 'mauvais' },
  },

  // Settings tab
  settings: {
    family: 'Famille',
    familyName: 'Nom de la famille',
    timeZone: 'Fuseau horaire',
    weekStart: 'La semaine commence le',
    monday: 'Lundi',
    sunday: 'Dimanche',
    language: 'Langue',
    save: 'Enregistrer',
    children: 'Enfants',
    rename: 'Renommer',
    addChild: '+ Ajouter un enfant',
    confirmDeleteChild: (name) =>
      `Supprimer ${name} et tout son historique ? Cette action est irréversible.`,
    parents: 'Parents',
    owner: 'Propriétaire',
    parentRole: 'Parent',
    you: 'toi',
    makeOwner: 'Nommer propriétaire',
    removeParent: 'Retirer',
    confirmMakeOwner: (name) => `Nommer ${name} propriétaire ? Tu deviendras un parent ordinaire.`,
    confirmRemoveParent: (name) => `Retirer ${name} de la famille ?`,
    inviteParent: 'Inviter un parent',
    inviteTitle: 'Lien d’invitation',
    inviteHelp: 'Envoie ce lien au parent. Il ne fonctionne qu’une seule fois.',
    inviteExpires: 'Expire dans 7 jours',
    openInvites: 'Invitations en attente',
    inviteSent: (date) => `Invitation envoyée le ${date}`,
    inviteUntil: (date) => `expire le ${date}`,
    cancelInvite: 'Annuler',
    copy: 'Copier',
    copied: 'Copié',
    share: 'Partager',
    done: 'Terminé',
    signOut: 'Se déconnecter',
    exportData: 'Télécharger toutes nos données',
    deleteTitle: 'Supprimer cette famille',
    deleteWarning:
      'Cela supprime tous les enfants, l’historique, les comportements, les récompenses et les appareils de toute la famille. Cette action est irréversible. Télécharge d’abord tes données.',
    deleteType: 'Saisis le nom de la famille pour confirmer',
    deleteButton: 'Supprimer cette famille',
    confirmDeleteFamily:
      'Supprimer cette famille et tout ce qu’elle contient ? Cette action est irréversible.',
    behaviors: 'Comportements',
    penalties: 'Pénalités',
    challenges: 'Défis de la semaine',
    rewards: 'Récompenses',
    devices: 'Appareils',
    edit: 'Modifier',
    remove: '✕',
    add: '+ Ajouter',
    confirmRemoveItem: 'Supprimer cet élément ? L’historique passé est conservé.',
    confirmRemoveReward: 'Supprimer cette récompense ?',
    up: '▲',
    down: '▼',

    // Edit form titles, by what is edited
    editTitle: {
      target: 'Modifier le comportement',
      penalty: 'Modifier la pénalité',
      challenge: 'Modifier le défi',
      reward: 'Modifier la récompense',
      child: 'Modifier l’enfant',
    },
    addTitle: {
      target: 'Ajouter un comportement',
      penalty: 'Ajouter une pénalité',
      challenge: 'Ajouter un défi',
      reward: 'Ajouter une récompense',
      child: 'Ajouter un enfant',
    },
    fieldName: 'Nom',
    fieldStars: 'Étoiles nécessaires',
    fieldPoints: 'Points nécessaires',
    fieldNote: 'Note (ex. par jour)',
    fieldPenalty: 'Points perdus',
    fieldMin: 'Points (min.)',
    fieldMax: 'Points (max. ; comme le min. si fixe)',
    cancel: 'Annuler',

    // Devices
    devicesHelp:
      'Les téléphones et navigateurs connectés. Déconnecte celui qui est perdu ou qui ne sert plus.',
    parentDevice: 'Parent',
    childDevice: 'Enfant',
    deviceLabel: (who, device) => `${who} · ${device}`,
    addDevice: (name) => `Ajouter un appareil pour ${name}`,
    pairTitle: (name) => `Appareil de ${name}`,
    pairHelp: 'Sur l’appareil de l’enfant, ouvre le lien ou saisis ce code.',
    expiresIn: (t) => `Expire dans ${t}`,
    expired: 'Expiré',
    thisDevice: 'cet appareil',
    lastUsed: (ago) => `Dernière utilisation : ${ago}`,
    loggedIn: (date) => `connecté ${date}`,
    logOut: 'Déconnecter',
    confirmLogOutMe: 'Déconnecter cet appareil ? Tu devras te reconnecter.',
    confirmLogOutOther:
      'Déconnecter cet appareil ? Il devra se reconnecter ou être de nouveau associé.',
  },

  // "Last seen" wording
  ago: {
    justNow: 'à l’instant',
    min: (n) => `il y a ${n} min`,
    hours: (n) => `il y a ${n} h`,
    days: (n) => `il y a ${n} jour${n > 1 ? 's' : ''}`,
  },

  // Errors from the server, by the `code` it sends. Functions get the reply's extra fields.
  errors: {
    login: 'Connecte-toi à nouveau.',
    viewOnly: 'Cet appareil peut seulement regarder, pas modifier.',
    badRequest: 'Ça n’a pas fonctionné. Réessaie.',
    notFound: 'Cet élément n’existe plus. Il a peut-être été supprimé depuis un autre appareil.',
    tooLarge: 'Le texte est trop long.',
    jsonOnly: 'Ça n’a pas fonctionné. Recharge la page et réessaie.',
    foreignOrigin: 'Requête venant d’un autre site refusée.',
    serverError: 'Un problème est survenu sur le serveur. Réessaie.',
    nameRequired: 'Un nom est obligatoire.',
    invalidDay: 'Ce jour n’est pas valide.',
    invalidTimeZone: 'Fuseau horaire inconnu.',
    invalidLanguage: 'Langue inconnue.',
    setupDone: 'Ce compte a déjà une famille.',
    setupNotAllowed: 'Termine d’abord la connexion.',
    privateInstance:
      'Ce Little Wins est privé. Demande un lien d’invitation à un parent de la famille, puis connecte-toi depuis ce lien.',
    lastChild: 'Une famille a besoin d’au moins un enfant.',
    ownerOnly: 'Seul le propriétaire peut faire ça.',
    notYourself: 'Tu ne peux pas faire ça sur toi-même.',
    codeInvalid:
      'Ce code ne fonctionne pas. Il a peut-être expiré ou déjà été utilisé. Demande-en un nouveau à un parent.',
    limitReached: ({ limit }) =>
      `Cette famille a atteint sa limite pour ${
        {
          children: 'les enfants',
          parents: 'les parents',
          items: 'les comportements, pénalités et défis',
          rewards: 'les récompenses',
          devices: 'les appareils',
          entriesPerDay: 'les entrées du jour',
        }[limit] || limit
      }.`,
    confirmFamilyName: 'Saisis exactement le nom de la famille pour confirmer.',
    operatorOnly: 'Réservé aux opérateurs.',
    inviteInvalid:
      'Ce lien d’invitation ne fonctionne pas. Il a peut-être expiré ou déjà été utilisé.',
    tooManyTries: ({ seconds }) => `Trop d’essais. Réessaie dans ${seconds} s.`,
  },
};
