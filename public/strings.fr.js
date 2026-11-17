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
    signupTitle: 'Vous êtes invité à créer une famille',
    signupHelp:
      "Connectez-vous pour créer votre famille sur ce Little Wins. L'invitation ne fonctionne qu'une fois.",
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
  // The welcome on the sign-in page
  welcome: {
    tagline: 'Célébrez les petites victoires, une étoile à la fois.',
    perks: [
      ['⭐', 'Des points et des étoiles pour ce qui va bien'],
      ['🏆', 'Des récompenses choisies en famille'],
      ['🌈', "Que des bonnes nouvelles sur l'écran de votre enfant"],
    ],
  },
  legal: { privacy: 'Confidentialité', terms: 'Conditions' },
  operator: {
    idleAfter: 'Familles inactives supprimées après',
    days: (n) => `${n} jours`,
    never: 'jamais',
    ofLimit: (n, max) => `${n} / ${max}`,
    familyInvites: 'Invitations de familles',
    familyInvitesHelp:
      "Seules les familles invitées peuvent s'inscrire ici. Chaque lien fonctionne une fois, pendant 30 jours.",
    inviteFamily: 'Inviter une famille',
    familyInviteTitle: "Lien d'invitation",
    familyInviteHelp: "Envoyez ce lien à la famille. Il ne fonctionne qu'une fois.",
    familyInviteExpires: 'Expire dans 30 jours',
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
    full: "Ce Little Wins est complet pour le moment : il n'a plus de place pour de nouvelles familles.",
    askForPlace: 'Demander une place',
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
  note: 'Note',
  noteLower: 'note',
  notePrompt:
    'Note pour les parents (votre enfant ne la voit jamais). Laissez vide pour la supprimer.',
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

  notices: {
    on: '🔔 Notifications sur son appareil : activées',
    off: '🔔 Notifications sur son appareil : désactivées',
    offer:
      'Reçois une notification sur cet appareil quand tu débloques une récompense ou atteins un palier.',
    turnOn: 'Activer les notifications',
  },
  reminder: {
    title: 'Rappel du soir',
    help: "Un rappel sur ce téléphone pour noter les défis du jour, envoyé seulement s'il reste quelque chose à noter. Il passe par le service de notifications du fabricant (Apple, Google ou Mozilla), qui ne peut pas le lire.",
    time: 'Me le rappeler à',
    turnOn: 'Me le rappeler sur ce téléphone',
    save: "Enregistrer l'heure",
    off: 'Désactiver',
    on: (t) => `Activé : tous les jours à ${t}, sur ce téléphone.`,
    denied:
      'Les notifications sont bloquées pour Little Wins. Autorisez-les dans les réglages du téléphone ou du navigateur, puis réessayez.',
    unsupported:
      "Ce navigateur ne peut pas afficher de rappels. Sur iPhone, ajoutez d'abord Little Wins à l'écran d'accueil (Partager, puis Sur l'écran d'accueil) et ouvrez-le depuis là.",
    failed: "Le rappel n'a pas pu être activé. Réessayez.",
  },
  cheer: {
    from: (who) => `de ${who}`,
    write: (name) => `💬 Écrire un message à ${name}`,
    change: 'Modifier',
    clear: 'Effacer',
    prompt: (name) =>
      `Un petit message pour ${name} (140 caractères au plus). Il s'affiche sur son écran Aujourd'hui pendant une semaine. Laissez vide pour le retirer.`,
    streak: (n) => `🔥 ${n} jours parfaits d'affilée !`,
    best: "🏅 Meilleure semaine jusqu'ici !",
  },
  review: {
    open: 'Bilan de la semaine',
    title: (name) => `Bilan de la semaine : ${name}`,
    stars: 'Étoiles gagnées',
    earned: 'Points gagnés',
    lost: 'Points perdus (pénalités)',
    warnings: 'Avertissements',
    perfectDays: 'Jours parfaits',
    badDays: 'Mauvais jours',
    byDay: 'Points par jour',
    challenges: 'Défis de la semaine',
    top: 'Le plus souvent',
    warnedFor: 'Avertissements pour',
    recent: 'Les 4 dernières semaines',
    week: 'Semaine du',
    times: (n) => `${n}×`,
    none: "Rien n'a été enregistré cette semaine.",
    print: 'Imprimer',
    back: 'Retour à la semaine',
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
    fieldEmoji: 'Émoji',
    noEmoji: 'Sans émoji',
    forLabel: (names) => `Pour : ${names}`,
    forNobody: "personne pour l'instant",
    forWho: 'Pour qui ?',
    forHelp: 'Cochez tous les enfants pour tout le monde, y compris ceux ajoutés plus tard.',
    idleNote: (days) =>
      `Une famille qu'aucun téléphone ni navigateur n'utilise pendant ${days} jours est supprimée, avec toutes ses données.`,
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

  // Demo families (DEMO_FAMILIES=1) and the tour video
  demo: {
    tryTitle: 'Essaie d’abord',
    tryHelp:
      'Ouvre une famille imaginaire, sans connexion. Rien de ce que tu y fais n’est conservé.',
    tryButton: 'Essayer la démo',
    videoTitle: 'Vois-le en 30 secondes',
    videoHelp: 'Une courte visite commentée de l’appli.',
    watchButton: 'Voir la vidéo',
    videoLabel: 'Vidéo de présentation',
    closeVideo: 'Fermer',
    bannerLabel: 'Démo',
    banner: (minutes) =>
      `Famille de démo : personnes et données imaginaires, supprimées après ${minutes} minutes sans activité.`,
    childView: (name) => `Vue de ${name}`,
    parentView: 'Vue des parents',
    leave: 'Quitter la démo',
    off: 'C’est une démo : inviter un autre parent, ajouter l’appareil d’un enfant, déconnecter des appareils, exporter et supprimer sont désactivés.',
    ended:
      'La démo s’est terminée après un moment sans activité. Tu peux en lancer une nouvelle quand tu veux.',
  },

  // The guided tour: a title (t) and a sentence or two (b) per step, by role
  tour: {
    offer: 'Nouveau ici ? Une visite rapide présente l’essentiel.',
    offerLabel: 'Proposition de visite',
    take: 'Faire la visite',
    noThanks: 'Non merci',
    step: (n, total) => `Étape ${n} sur ${total}`,
    back: 'Retour',
    next: 'Suivant',
    done: 'Terminé',
    close: 'Fermer',
    parent: {
      earn: {
        t: 'Gagner des points',
        b: 'Touche + quand ton enfant fait l’une de ces choses. Un comportement avec une fourchette demande combien de points.',
      },
      warn: {
        t: 'Avertissements',
        b: 'Un avertissement est un petit rappel à l’ordre, compté par jour (1/2). Il ne coûte aucun point.',
      },
      penalties: {
        t: 'Pénalités',
        b: 'Une pénalité retire des points après ta confirmation. Le solde ne descend jamais sous zéro, et les enfants ne voient jamais les pénalités.',
      },
      marks: {
        t: 'Défis de la semaine',
        b: 'Touche un jour pour le marquer parfait, correct ou mauvais. Deux jours parfaits et aucun mauvais jour font gagner une étoile pour la semaine.',
      },
      rewards: {
        t: 'Récompenses',
        b: 'Les récompenses se débloquent avec des étoiles et des points. L’anneau montre si la prochaine est proche ; rien n’est dépensé.',
      },
      history: {
        t: 'Historique et annulation',
        b: 'Tout ce qui est enregistré, du plus récent au plus ancien. Annuler corrige une erreur, et le solde est recalculé.',
      },
      settings: {
        t: 'Réglages',
        b: 'Modifie les comportements, pénalités, défis et récompenses, ajoute des enfants et invite un autre parent.',
      },
      device: {
        t: 'Le téléphone de ton enfant',
        b: 'Dans Appareils, ajoute un appareil pour obtenir un code à usage unique pour le téléphone de ton enfant. Il n’y voit que sa progression : ni pénalités, ni avertissements, ni notes.',
      },
    },
    child: {
      header: {
        t: 'Tes points et tes étoiles',
        b: 'Tes points et tes étoiles sont toujours en haut.',
      },
      ring: {
        t: 'Ta prochaine récompense',
        b: 'L’anneau montre si ta prochaine récompense est proche.',
      },
      earn: {
        t: 'Comment gagner',
        b: 'Ça rapporte des points. Un parent les ajoute quand tu les fais.',
      },
      marks: {
        t: 'Cette semaine',
        b: 'Tes défis jour par jour. Deux jours parfaits et aucun mauvais jour font gagner une étoile.',
      },
      rewards: {
        t: 'Récompenses',
        b: 'Chaque récompense et ce qu’il faut pour l’obtenir. Continue !',
      },
    },
  },

  // Errors from the server, by the `code` it sends. Functions get the reply's extra fields.
  errors: {
    serviceFull:
      "Ce Little Wins est complet pour le moment : il n'a plus de place pour de nouvelles familles.",
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
    demoOff: 'Ce n’est pas disponible dans la démo.',
    demoEnded:
      'La démo s’est terminée après un moment sans activité. Tu peux en lancer une nouvelle quand tu veux.',
    demoFull:
      'Toutes les familles de démo sont occupées en ce moment. Prends un thé et réessaie dans quelques minutes.',
  },
};
