// German strings for the page. Same keys as strings.en.js; missing keys fall back to English.
window.LW_STRINGS = window.LW_STRINGS || {};
window.LW_STRINGS.de = {
  appName: 'Little Wins',
  locale: 'de',

  // Bottom tabs: [icon, label]
  tabs: {
    today: ['☀️', 'Heute'],
    week: ['⭐', 'Woche'],
    rew: ['🏆', 'Belohnungen'],
    hist: ['🕘', 'Verlauf'],
    set: ['⚙️', 'Einstellungen'],
  },

  // Header and shared bits
  header: (balance, stars) => `${balance} Pkt. · ${stars} ★`,
  pts: 'Pkt.',
  ptsRange: (a, b) => `${a}-${b} Pkt.`,
  star: '★',

  // Signed-out screen, invite and setup
  login: {
    signupTitle: 'Sie sind eingeladen, eine Familie anzulegen',
    signupHelp:
      'Melden Sie sich an, um Ihre Familie in diesem Little Wins anzulegen. Die Einladung funktioniert einmal.',
    signInWith: { google: 'Mit Google anmelden', github: 'Mit GitHub anmelden' },
    parentsOnly: 'Für Eltern',
    codeTitle: 'Code von einem Elternteil nutzen',
    codeHelp:
      'Gib auf dem Gerät des Kindes den Code ein, den ein Elternteil in den Einstellungen erstellt hat.',
    codePlaceholder: 'ABCD-EFGH-JK',
    codeButton: 'Dieses Gerät verbinden',
    codeFailed: 'Mit diesem Code hat es nicht geklappt. Bitte ein Elternteil um einen neuen.',
    joinTitle: (family) => `${family} beitreten`,
    joinHelp: 'Melde dich an, um dieser Familie als Elternteil beizutreten.',
    inviteInvalid:
      'Dieser Einladungslink funktioniert nicht. Er ist vielleicht abgelaufen oder wurde schon benutzt.',
    notNow: 'Jetzt nicht',
    networkError: 'Der Server ist nicht erreichbar. Versuch es noch einmal.',
    familyDeleted: 'Familie gelöscht.',
  },
  legal: { privacy: 'Datenschutz', terms: 'Nutzungsbedingungen' },
  operator: {
    ofLimit: (n, max) => `${n} / ${max}`,
    familyInvites: 'Familien-Einladungen',
    familyInvitesHelp:
      'Nur eingeladene Familien können sich hier anmelden. Jeder Link funktioniert einmal, 30 Tage lang.',
    inviteFamily: 'Eine Familie einladen',
    familyInviteTitle: 'Einladungslink',
    familyInviteHelp: 'Senden Sie diesen Link an die Familie. Er funktioniert einmal.',
    familyInviteExpires: 'Läuft in 30 Tagen ab',
    title: 'Betreiber',
    help: 'Zahlen zu dieser Installation. Inhalte der Familien werden hier nie angezeigt.',
    loading: 'Wird geladen …',
    refresh: 'Aktualisieren',
    failed: 'Die Zahlen konnten nicht geladen werden. Versuch es noch einmal.',
    families: 'Familien',
    unclaimedFamilies: 'Nicht übernommene Familien',
    parents: 'Eltern',
    children: 'Kinder',
    devices: 'Geräte',
    activeDevices30d: 'Aktive Geräte (30 Tage)',
    entries: 'Einträge',
    dbSize: 'Datenbankgröße',
    mb: (n) => `${n} MB`,
    version: 'Version',
    uptime: 'Laufzeit',
    duration: (s) => {
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      return d ? `${d} Tg. ${h} Std.` : h ? `${h} Std. ${m} Min.` : `${m} Min.`;
    },
  },
  setup: {
    full: 'Dieses Little Wins ist im Moment voll: Es ist kein Platz für neue Familien.',
    askForPlace: 'Um einen Platz bitten',
    title: 'Familie einrichten',
    hello: (name) => `Willkommen, ${name}.`,
    familyName: 'Familienname',
    childName: 'Name des ersten Kindes',
    timeZone: 'Zeitzone',
    weekStart: 'Die Woche beginnt am',
    monday: 'Montag',
    sunday: 'Sonntag',
    starter: 'Mit einer Beispielliste für Verhalten und Belohnungen starten',
    language: 'Sprache',
    create: 'Erstellen',
    private:
      'Dieses Little Wins ist privat. Bitte ein Elternteil der Familie um einen Einladungslink und melde dich darüber an.',
    signOut: 'Abmelden',
  },

  // Toast and history descriptions
  undo: 'Rückgängig',
  undoLower: 'rückgängig',
  note: 'Notiz',
  noteLower: 'Notiz',
  notePrompt: 'Notiz für Eltern (Ihr Kind sieht sie nie). Leer lassen, um sie zu entfernen.',
  warningPrefix: '⚠ Verwarnung · ',

  // Next-reward ring
  ring: {
    allUnlocked: '🎉 Alles freigeschaltet!',
    next: 'Nächste Belohnung',
    pts: 'Pkt.',
  },

  // Celebration overlay
  party: {
    unlocked: 'Belohnung freigeschaltet!',
  },

  // Today tab
  today: {
    earn: 'Punkte sammeln',
    waysToEarn: 'So sammelst du Punkte',
    penalties: 'Abzüge',
    promptPoints: (min, max) => `Punkte (${min}-${max})`,
    confirmPenalty: (name) => `Abzug eintragen: ${name}?`,
    warnButton: (n) => `⚠${n}/2`,
  },

  // Week tab
  week: {
    prevLabel: 'Vorherige Woche',
    nextLabel: 'Nächste Woche',
    thisWeek: 'Diese Woche',
    weekOf: (d) => `Woche vom ${d}`,
    starsWon: (n) => ` · ${n} ★ gewonnen`,
    back: 'Zurück zu dieser Woche',
    challenges: 'Wochenchallenges',
    rule: 'Gewinne einen ★ mit mindestens 2 perfekten Tagen und keinem schlechten Tag in der Woche.',
    ruleParent: ' Tippe auf einen Tag: ✓ perfekt, ~ okay oder ✗ schlecht.',
    won: '★ gewonnen',
    perfectDays: (n) => `${n}/2 perfekte Tage`,
    aBadDay: ' · ein schlechter Tag',
    marks: { perfect: '✓', ok: '~', bad: '✗', none: '·' },
  },

  // Rewards tab
  rewards: {
    title: 'Belohnungen',
    unlocked: '✅ freigeschaltet',
    pointsPlus: (n) => `+ ${n} Pkt.`,
  },

  // History tab
  history: {
    title: 'Verlauf',
    warning: '⚠ Verwarnung',
    mark: 'Bewertung: ',
    // Challenge marks, by name
    markNames: { perfect: 'perfekt', ok: 'okay', bad: 'schlecht' },
  },

  // Settings tab
  settings: {
    family: 'Familie',
    familyName: 'Familienname',
    timeZone: 'Zeitzone',
    weekStart: 'Die Woche beginnt am',
    monday: 'Montag',
    sunday: 'Sonntag',
    language: 'Sprache',
    save: 'Speichern',
    children: 'Kinder',
    rename: 'Umbenennen',
    addChild: '+ Kind hinzufügen',
    confirmDeleteChild: (name) =>
      `${name} und den gesamten Verlauf löschen? Das lässt sich nicht rückgängig machen.`,
    parents: 'Eltern',
    owner: 'Inhaber',
    parentRole: 'Elternteil',
    you: 'du',
    makeOwner: 'Zum Inhaber machen',
    removeParent: 'Entfernen',
    confirmMakeOwner: (name) =>
      `${name} zum Inhaber machen? Du wirst dann ein normales Elternteil.`,
    confirmRemoveParent: (name) => `${name} aus der Familie entfernen?`,
    inviteParent: 'Elternteil einladen',
    inviteTitle: 'Einladungslink',
    inviteHelp: 'Schick diesen Link an das Elternteil. Er funktioniert nur einmal.',
    inviteExpires: 'Läuft in 7 Tagen ab',
    openInvites: 'Offene Einladungen',
    inviteSent: (date) => `Einladung gesendet am ${date}`,
    inviteUntil: (date) => `läuft ab am ${date}`,
    cancelInvite: 'Abbrechen',
    copy: 'Kopieren',
    copied: 'Kopiert',
    share: 'Teilen',
    done: 'Fertig',
    signOut: 'Abmelden',
    exportData: 'Alle unsere Daten herunterladen',
    deleteTitle: 'Diese Familie löschen',
    deleteWarning:
      'Dadurch werden alle Kinder, der Verlauf, Verhalten, Belohnungen und Geräte für die ganze Familie gelöscht. Das lässt sich nicht rückgängig machen. Lade vorher deine Daten herunter.',
    deleteType: 'Zur Bestätigung den Familiennamen eingeben',
    deleteButton: 'Familie löschen',
    confirmDeleteFamily:
      'Diese Familie mit allem, was dazugehört, löschen? Das lässt sich nicht rückgängig machen.',
    behaviors: 'Verhalten',
    penalties: 'Abzüge',
    challenges: 'Wochenchallenges',
    rewards: 'Belohnungen',
    devices: 'Geräte',
    edit: 'Bearbeiten',
    remove: '✕',
    add: '+ Neu',
    confirmRemoveItem: 'Das entfernen? Der bisherige Verlauf bleibt erhalten.',
    confirmRemoveReward: 'Diese Belohnung entfernen?',
    up: '▲',
    down: '▼',

    // Edit form titles, by what is edited
    editTitle: {
      target: 'Verhalten bearbeiten',
      penalty: 'Abzug bearbeiten',
      challenge: 'Challenge bearbeiten',
      reward: 'Belohnung bearbeiten',
      child: 'Kind bearbeiten',
    },
    addTitle: {
      target: 'Verhalten hinzufügen',
      penalty: 'Abzug hinzufügen',
      challenge: 'Challenge hinzufügen',
      reward: 'Belohnung hinzufügen',
      child: 'Kind hinzufügen',
    },
    fieldName: 'Name',
    fieldStars: 'Benötigte Sterne',
    fieldPoints: 'Benötigte Punkte',
    fieldNote: 'Hinweis (z. B. pro Tag)',
    fieldPenalty: 'Abgezogene Punkte',
    fieldMin: 'Punkte (min.)',
    fieldMax: 'Punkte (max.; wie min., wenn fest)',
    cancel: 'Abbrechen',

    // Devices
    devicesHelp:
      'Handys und Browser, die angemeldet sind. Melde ein Gerät ab, das verloren gegangen ist oder nicht mehr benutzt wird.',
    parentDevice: 'Elternteil',
    childDevice: 'Kind',
    deviceLabel: (who, device) => `${who} · ${device}`,
    addDevice: (name) => `Gerät für ${name} hinzufügen`,
    pairTitle: (name) => `Gerät für ${name}`,
    pairHelp: 'Öffne auf dem Gerät des Kindes den Link oder gib diesen Code ein.',
    expiresIn: (t) => `Läuft ab in ${t}`,
    expired: 'Abgelaufen',
    thisDevice: 'dieses Gerät',
    lastUsed: (ago) => `Zuletzt benutzt ${ago}`,
    loggedIn: (date) => `angemeldet am ${date}`,
    logOut: 'Abmelden',
    confirmLogOutMe: 'Dieses Gerät abmelden? Du musst dich danach neu anmelden.',
    confirmLogOutOther:
      'Dieses Gerät abmelden? Es muss sich danach neu anmelden oder neu verbunden werden.',
  },

  // "Last seen" wording
  ago: {
    justNow: 'gerade eben',
    min: (n) => `vor ${n} Min.`,
    hours: (n) => `vor ${n} Std.`,
    days: (n) => `vor ${n} Tagen`,
  },

  // Demo families (DEMO_FAMILIES=1) and the tour video
  demo: {
    tryTitle: 'Erst mal ausprobieren',
    tryHelp:
      'Öffne eine ausgedachte Familie, ganz ohne Anmeldung. Nichts, was du dort machst, wird gespeichert.',
    tryButton: 'Demo testen',
    videoTitle: 'In 30 Sekunden erklärt',
    videoHelp: 'Eine kurze Tour durch die App mit Erzählstimme.',
    watchButton: 'Video ansehen',
    videoLabel: 'Tour-Video',
    closeVideo: 'Schließen',
    bannerLabel: 'Demo',
    banner: (minutes) =>
      `Demo-Familie: ausgedachte Personen und Daten, nach ${minutes} Minuten ohne Nutzung gelöscht.`,
    childView: (name) => `Ansicht von ${name}`,
    parentView: 'Elternansicht',
    leave: 'Demo verlassen',
    off: 'Das ist eine Demo: Ein weiteres Elternteil einladen, ein Gerät für ein Kind hinzufügen, Geräte abmelden, Export und Löschen sind ausgeschaltet.',
    ended:
      'Die Demo wurde nach einer Weile ohne Nutzung beendet. Du kannst jederzeit eine neue starten.',
  },

  // The guided tour: a title (t) and a sentence or two (b) per step, by role
  tour: {
    offer: 'Neu hier? Eine kurze Tour zeigt dir das Wichtigste.',
    offerLabel: 'Tour-Angebot',
    take: 'Tour starten',
    noThanks: 'Nein danke',
    step: (n, total) => `Schritt ${n} von ${total}`,
    back: 'Zurück',
    next: 'Weiter',
    done: 'Fertig',
    close: 'Schließen',
    parent: {
      earn: {
        t: 'Punkte sammeln',
        b: 'Tippe auf +, wenn dein Kind eines davon macht. Bei einem Verhalten mit Spanne wirst du nach den Punkten gefragt.',
      },
      warn: {
        t: 'Verwarnungen',
        b: 'Eine Verwarnung ist ein sanfter Hinweis, pro Tag gezählt (1/2). Sie kostet keine Punkte.',
      },
      penalties: {
        t: 'Abzüge',
        b: 'Ein Abzug nimmt Punkte weg, sobald du bestätigst. Das Guthaben fällt nie unter null, und Kinder sehen Abzüge nie.',
      },
      marks: {
        t: 'Wochenchallenges',
        b: 'Tippe auf einen Tag: perfekt, okay oder schlecht. Zwei perfekte Tage und kein schlechter Tag bringen einen Stern für die Woche.',
      },
      rewards: {
        t: 'Belohnungen',
        b: 'Belohnungen werden mit Sternen und Punkten freigeschaltet. Der Ring zeigt, wie nah die nächste ist; es wird nichts ausgegeben.',
      },
      history: {
        t: 'Verlauf und Rückgängig',
        b: 'Alles Eingetragene, das Neueste zuerst. Mit Rückgängig korrigierst du einen Fehler, und das Guthaben wird neu berechnet.',
      },
      settings: {
        t: 'Einstellungen',
        b: 'Ändere Verhalten, Abzüge, Challenges und Belohnungen, füge Kinder hinzu und lade ein weiteres Elternteil ein.',
      },
      device: {
        t: 'Das Handy deines Kindes',
        b: 'Füge unter Geräte ein Gerät hinzu, um einen Einmalcode für das Handy deines Kindes zu bekommen. Es zeigt nur den Fortschritt deines Kindes: keine Abzüge, Verwarnungen oder Notizen.',
      },
    },
    child: {
      header: {
        t: 'Deine Punkte und Sterne',
        b: 'Deine Punkte und Sterne stehen immer ganz oben.',
      },
      ring: {
        t: 'Deine nächste Belohnung',
        b: 'Der Ring zeigt, wie nah du deiner nächsten Belohnung bist.',
      },
      earn: {
        t: 'So sammelst du',
        b: 'Dafür gibt es Punkte. Ein Elternteil trägt sie ein, wenn du sie schaffst.',
      },
      marks: {
        t: 'Diese Woche',
        b: 'Deine Challenges, Tag für Tag. Zwei perfekte Tage und kein schlechter Tag bringen einen Stern.',
      },
      rewards: { t: 'Belohnungen', b: 'Jede Belohnung und was dafür nötig ist. Weiter so!' },
    },
  },

  // Errors from the server, by the `code` it sends. Functions get the reply's extra fields.
  errors: {
    serviceFull: 'Dieses Little Wins ist im Moment voll: Es ist kein Platz für neue Familien.',
    login: 'Bitte melde dich neu an.',
    viewOnly: 'Dieses Gerät darf nur ansehen, nichts ändern.',
    badRequest: 'Das hat nicht geklappt. Versuch es noch einmal.',
    notFound: 'Das gibt es nicht mehr. Vielleicht wurde es auf einem anderen Gerät entfernt.',
    tooLarge: 'Das ist zu lang.',
    jsonOnly: 'Das hat nicht geklappt. Lade die Seite neu und versuch es noch einmal.',
    foreignOrigin: 'Anfrage von einer anderen Website abgelehnt.',
    serverError: 'Auf dem Server ist etwas schiefgelaufen. Versuch es noch einmal.',
    nameRequired: 'Ein Name ist erforderlich.',
    invalidDay: 'Dieser Tag ist ungültig.',
    invalidTimeZone: 'Unbekannte Zeitzone.',
    invalidLanguage: 'Unbekannte Sprache.',
    setupDone: 'Dieses Konto hat schon eine Familie.',
    setupNotAllowed: 'Schließe zuerst die Anmeldung ab.',
    privateInstance:
      'Dieses Little Wins ist privat. Bitte ein Elternteil der Familie um einen Einladungslink und melde dich darüber an.',
    lastChild: 'Eine Familie braucht mindestens ein Kind.',
    ownerOnly: 'Das kann nur der Inhaber.',
    notYourself: 'Das kannst du bei dir selbst nicht tun.',
    codeInvalid:
      'Dieser Code funktioniert nicht. Er ist vielleicht abgelaufen oder wurde schon benutzt. Bitte ein Elternteil um einen neuen.',
    limitReached: ({ limit }) =>
      `Diese Familie hat das Limit für ${
        {
          children: 'Kinder',
          parents: 'Eltern',
          items: 'Verhalten, Abzüge und Challenges',
          rewards: 'Belohnungen',
          devices: 'Geräte',
          entriesPerDay: 'Einträge heute',
        }[limit] || limit
      } erreicht.`,
    confirmFamilyName: 'Gib zur Bestätigung den Familiennamen genau so ein.',
    operatorOnly: 'Das können nur Betreiber sehen.',
    inviteInvalid:
      'Dieser Einladungslink funktioniert nicht. Er ist vielleicht abgelaufen oder wurde schon benutzt.',
    tooManyTries: ({ seconds }) => `Zu viele Versuche. Versuch es in ${seconds} s noch einmal.`,
    demoOff: 'Das ist in der Demo nicht verfügbar.',
    demoEnded:
      'Die Demo wurde nach einer Weile ohne Nutzung beendet. Du kannst jederzeit eine neue starten.',
    demoFull:
      'Alle Demo-Familien sind gerade belegt. Hol dir einen Tee und versuch es in ein paar Minuten noch einmal.',
  },
};
