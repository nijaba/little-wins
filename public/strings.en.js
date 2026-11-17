// Every user-facing string of the page, in English: the base language. Other languages live in
// strings.<lang>.js with the same keys; anything a translation leaves out falls back to this file.
// Entries that depend on a value are functions; the caller escapes user-entered text.
window.LW_STRINGS = window.LW_STRINGS || {};
window.LW_STRINGS.en = {
  appName: 'Little Wins',
  // BCP 47 locale for dates and numbers (Intl).
  locale: 'en',

  // Bottom tabs: [icon, label]
  tabs: {
    today: ['☀️', 'Today'],
    week: ['⭐', 'Week'],
    rew: ['🏆', 'Rewards'],
    hist: ['🕘', 'History'],
    set: ['⚙️', 'Settings'],
  },

  // Header and shared bits
  header: (balance, stars) => `${balance} pts · ${stars} ★`,
  pts: 'pts',
  ptsRange: (a, b) => `${a}-${b} pts`,
  star: '★',

  // Signed-out screen, invite and setup
  login: {
    signupTitle: "You're invited to start a family",
    signupHelp: 'Sign in to set up your family on this Little Wins. The invite works once.',
    signInWith: { google: 'Sign in with Google', github: 'Sign in with GitHub' },
    parentsOnly: 'For parents',
    codeTitle: 'Use a code from a parent',
    codeHelp: "On a child's device, type the code a parent made in Settings.",
    codePlaceholder: 'ABCD-EFGH-JK',
    codeButton: 'Connect this device',
    codeFailed: "That code didn't work. Ask a parent for a new one.",
    joinTitle: (family) => `Join ${family}`,
    joinHelp: 'Sign in to join this family as a parent.',
    inviteInvalid: "This invite link doesn't work. It may have expired or been used.",
    notNow: 'Not now',
    networkError: "Can't reach the server. Try again.",
    familyDeleted: 'Family deleted.',
  },
  legal: { privacy: 'Privacy', terms: 'Terms' },
  operator: {
    idleAfter: 'Idle families deleted after',
    days: (n) => `${n} days`,
    never: 'never',
    ofLimit: (n, max) => `${n} / ${max}`,
    familyInvites: 'Family invites',
    familyInvitesHelp:
      'Only families with an invite can sign up here. Each link works once, for 30 days.',
    inviteFamily: 'Invite a family',
    familyInviteTitle: 'Family invite link',
    familyInviteHelp: 'Send this link to the family. It works once.',
    familyInviteExpires: 'Expires in 30 days',
    title: 'Operator',
    help: 'Numbers about this installation. Family content is never shown here.',
    loading: 'Loading…',
    refresh: 'Refresh',
    failed: "Couldn't load the numbers. Try again.",
    families: 'Families',
    unclaimedFamilies: 'Unclaimed families',
    parents: 'Parents',
    children: 'Children',
    devices: 'Devices',
    activeDevices30d: 'Active devices (30 days)',
    entries: 'Entries',
    dbSize: 'Database size',
    mb: (n) => `${n} MB`,
    version: 'Version',
    uptime: 'Uptime',
    duration: (s) => {
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
    },
  },
  setup: {
    full: 'This Little Wins is full for now: it has no room for new families.',
    askForPlace: 'Ask for a place',
    title: 'Set up your family',
    hello: (name) => `Welcome, ${name}.`,
    familyName: 'Family name',
    childName: "First child's name",
    timeZone: 'Time zone',
    weekStart: 'Week starts on',
    monday: 'Monday',
    sunday: 'Sunday',
    starter: 'Start with a sample list of behaviors and rewards',
    language: 'Language',
    create: 'Create',
    private:
      'This Little Wins is private. Ask a parent in the family for an invite link, then sign in from it.',
    signOut: 'Sign out',
  },

  // Toast and history descriptions
  undo: 'Undo',
  undoLower: 'undo',
  note: 'Note',
  noteLower: 'note',
  notePrompt: 'Note for parents (your child never sees it). Leave empty to remove it.',
  warningPrefix: '⚠ Warning · ',

  // Next-reward ring
  ring: {
    allUnlocked: '🎉 Everything unlocked!',
    next: 'Next reward',
    pts: 'pts',
  },

  // Celebration overlay
  party: {
    unlocked: 'Reward unlocked!',
  },

  // Today tab
  today: {
    earn: 'Earn points',
    waysToEarn: 'Ways to earn points',
    penalties: 'Penalties',
    promptPoints: (min, max) => `Points (${min}-${max})`,
    confirmPenalty: (name) => `Record penalty: ${name}?`,
    warnButton: (n) => `⚠${n}/2`,
  },

  // Week tab
  week: {
    prevLabel: 'Previous week',
    nextLabel: 'Next week',
    thisWeek: 'This week',
    weekOf: (d) => `Week of ${d}`,
    starsWon: (n) => ` · ${n} ★ won`,
    back: 'Back to this week',
    challenges: 'Weekly challenges',
    rule: 'Win ★ with 2+ perfect days and no bad days in the week.',
    ruleParent: ' Tap a day to set ✓ perfect, ~ ok or ✗ bad.',
    won: '★ won',
    perfectDays: (n) => `${n}/2 perfect days`,
    aBadDay: ' · a bad day',
    marks: { perfect: '✓', ok: '~', bad: '✗', none: '·' },
  },

  // Rewards tab
  rewards: {
    title: 'Rewards',
    unlocked: '✅ unlocked',
    pointsPlus: (n) => `+ ${n} pts`,
  },

  // History tab
  history: {
    title: 'History',
    warning: '⚠ warning',
    mark: 'mark: ',
    // Challenge marks, by name
    markNames: { perfect: 'perfect', ok: 'OK', bad: 'bad' },
  },

  // Settings tab
  settings: {
    idleNote: (days) =>
      `A family that no phone or browser uses for ${days} days is deleted, with all its data.`,
    family: 'Family',
    familyName: 'Family name',
    timeZone: 'Time zone',
    weekStart: 'Week starts on',
    monday: 'Monday',
    sunday: 'Sunday',
    language: 'Language',
    save: 'Save',
    children: 'Children',
    rename: 'Rename',
    addChild: '+ Add child',
    confirmDeleteChild: (name) => `Delete ${name} and all their history? This can't be undone.`,
    parents: 'Parents',
    owner: 'Owner',
    parentRole: 'Parent',
    you: 'you',
    makeOwner: 'Make owner',
    removeParent: 'Remove',
    confirmMakeOwner: (name) => `Make ${name} the owner? You will become a regular parent.`,
    confirmRemoveParent: (name) => `Remove ${name} from the family?`,
    inviteParent: 'Invite a parent',
    inviteTitle: 'Invite link',
    inviteHelp: 'Send this link to the parent. It works once.',
    inviteExpires: 'Expires in 7 days',
    openInvites: 'Open invites',
    inviteSent: (date) => `Invite sent ${date}`,
    inviteUntil: (date) => `expires ${date}`,
    cancelInvite: 'Cancel',
    copy: 'Copy',
    copied: 'Copied',
    share: 'Share',
    done: 'Done',
    signOut: 'Sign out',
    exportData: 'Download all our data',
    deleteTitle: 'Delete this family',
    deleteWarning:
      "This deletes all children, history, behaviors, rewards and devices for everyone in the family. It can't be undone. Download your data first.",
    deleteType: 'Type the family name to confirm',
    deleteButton: 'Delete this family',
    confirmDeleteFamily: "Delete this family and everything in it? This can't be undone.",
    behaviors: 'Behaviors',
    penalties: 'Penalties',
    challenges: 'Weekly challenges',
    rewards: 'Rewards',
    devices: 'Devices',
    edit: 'Edit',
    remove: '✕',
    add: '+ Add',
    confirmRemoveItem: 'Remove this? Past history is kept.',
    confirmRemoveReward: 'Remove this reward?',
    up: '▲',
    down: '▼',

    // Edit form titles, by what is edited
    editTitle: {
      target: 'Edit behavior',
      penalty: 'Edit penalty',
      challenge: 'Edit challenge',
      reward: 'Edit reward',
      child: 'Edit child',
    },
    addTitle: {
      target: 'Add a behavior',
      penalty: 'Add a penalty',
      challenge: 'Add a challenge',
      reward: 'Add a reward',
      child: 'Add a child',
    },
    fieldName: 'Name',
    fieldStars: 'Stars needed',
    fieldPoints: 'Points needed',
    fieldNote: 'Note (e.g. per day)',
    fieldPenalty: 'Points lost',
    fieldMin: 'Points (min)',
    fieldMax: 'Points (max; same as min if fixed)',
    cancel: 'Cancel',

    // Devices
    devicesHelp:
      'Phones and browsers that are logged in. Log out one that is lost or no longer used.',
    parentDevice: 'Parent',
    childDevice: 'Child',
    deviceLabel: (who, device) => `${who} · ${device}`,
    addDevice: (name) => `Add a device for ${name}`,
    pairTitle: (name) => `Device for ${name}`,
    pairHelp: "On the child's device, open the link or type this code.",
    expiresIn: (t) => `Expires in ${t}`,
    expired: 'Expired',
    thisDevice: 'this device',
    lastUsed: (ago) => `Last used ${ago}`,
    loggedIn: (date) => `logged in ${date}`,
    logOut: 'Log out',
    confirmLogOutMe: 'Log out this device? You will need to sign in again.',
    confirmLogOutOther: 'Log out that device? It will need to sign in or pair again.',
  },

  // "Last seen" wording
  ago: {
    justNow: 'just now',
    min: (n) => `${n} min ago`,
    hours: (n) => `${n} h ago`,
    days: (n) => `${n} days ago`,
  },

  // Demo families (DEMO_FAMILIES=1) and the tour video
  demo: {
    tryTitle: 'Try it first',
    tryHelp: 'Open a made-up family, with no sign-in. Nothing you do there is kept.',
    tryButton: 'Try a demo',
    videoTitle: 'See it in 30 seconds',
    videoHelp: 'A short narrated tour of the app.',
    watchButton: 'Watch the video',
    videoLabel: 'Tour video',
    closeVideo: 'Close',
    bannerLabel: 'Demo',
    banner: (minutes) =>
      `Demo family: made-up people and data, deleted after ${minutes} minutes unused.`,
    childView: (name) => `${name}'s view`,
    parentView: "Parent's view",
    leave: 'Leave the demo',
    off: "This is a demo: inviting a co-parent, adding a child's device, logging devices out, export and delete are turned off.",
    ended: 'The demo ended after a while unused. Start a new one any time.',
  },

  // The guided tour: a title (t) and a sentence or two (b) per step, by role
  tour: {
    offer: 'New here? A quick tour shows the main parts.',
    offerLabel: 'Tour offer',
    take: 'Take the tour',
    noThanks: 'No thanks',
    step: (n, total) => `Step ${n} of ${total}`,
    back: 'Back',
    next: 'Next',
    done: 'Done',
    close: 'Close',
    parent: {
      earn: {
        t: 'Earning points',
        b: 'Tap + when your child does one of these. A behavior with a range asks how many points.',
      },
      warn: {
        t: 'Warnings',
        b: 'A warning is a gentle heads-up, counted per day (1/2). It costs no points.',
      },
      penalties: {
        t: 'Penalties',
        b: 'A penalty takes points away after you confirm. The balance never drops below zero, and children never see penalties.',
      },
      marks: {
        t: 'Weekly challenges',
        b: 'Tap a day to mark it perfect, OK or bad. Two perfect days and no bad day win a star for the week.',
      },
      rewards: {
        t: 'Rewards',
        b: 'Rewards unlock with stars and points. The ring shows how close the next one is; nothing is spent.',
      },
      history: {
        t: 'History and undo',
        b: 'Everything recorded, newest first. Undo fixes a mistake, and the balance is worked out again.',
      },
      settings: {
        t: 'Settings',
        b: 'Change behaviors, penalties, challenges and rewards, add children, and invite a co-parent.',
      },
      device: {
        t: "Your child's phone",
        b: "Under Devices, add a device to get a one-time code for your child's phone. It shows only their progress: no penalties, warnings or notes.",
      },
    },
    child: {
      header: { t: 'Your points and stars', b: 'Your points and stars are always at the top.' },
      ring: { t: 'Your next reward', b: 'The ring shows how close you are to your next reward.' },
      earn: {
        t: 'Ways to earn',
        b: 'These earn points. A parent adds them when you do them.',
      },
      marks: {
        t: 'This week',
        b: 'Your challenges day by day. Two perfect days and no bad day win a star.',
      },
      rewards: { t: 'Rewards', b: 'Every reward and what it needs. Keep going!' },
    },
  },

  // API errors, by their code
  // Errors from the server, by the `code` it sends. Functions get the reply's extra fields.
  errors: {
    serviceFull: 'This Little Wins is full for now: it has no room for new families.',
    login: 'Please sign in again.',
    viewOnly: 'This device can only look, not change things.',
    badRequest: "That didn't work. Try again.",
    notFound: "That isn't here any more. It may have been removed on another device.",
    tooLarge: 'That is too long.',
    jsonOnly: "That didn't work. Reload the page and try again.",
    foreignOrigin: 'Request from another site refused.',
    serverError: 'Something went wrong on the server. Try again.',
    nameRequired: 'A name is required.',
    invalidDay: 'That day is not valid.',
    invalidTimeZone: 'Unknown time zone.',
    invalidLanguage: 'Unknown language.',
    setupDone: 'This account already has a family.',
    setupNotAllowed: 'Finish signing in first.',
    privateInstance:
      'This Little Wins is private. Ask a parent in the family for an invite link, then sign in from it.',
    lastChild: 'A family needs at least one child.',
    ownerOnly: 'Only the owner can do that.',
    notYourself: "You can't do that to yourself.",
    codeInvalid:
      "That code doesn't work. It may have expired or been used. Ask a parent for a new one.",
    limitReached: ({ limit }) =>
      `This family has reached its limit for ${
        {
          children: 'children',
          parents: 'parents',
          items: 'behaviors, penalties and challenges',
          rewards: 'rewards',
          devices: 'devices',
          entriesPerDay: 'entries today',
        }[limit] || limit
      }.`,
    confirmFamilyName: 'Type the family name exactly to confirm.',
    operatorOnly: 'Only operators can see this.',
    inviteInvalid: "This invite link doesn't work. It may have expired or been used.",
    tooManyTries: ({ seconds }) => `Too many tries. Try again in ${seconds}s.`,
    demoOff: "That isn't available in the demo.",
    demoEnded: 'The demo ended after a while unused. Start a new one any time.',
    demoFull:
      'Every demo family is busy right now. Grab a cup of tea and try again in a few minutes.',
  },
};
