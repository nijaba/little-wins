// Every user-facing string of the page, in one place so it can be translated later.
// Entries that depend on a value are functions; the caller escapes user-entered text.
window.STRINGS = {
  appName: 'Little Wins',

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
  },
  setup: {
    title: 'Set up your family',
    hello: (name) => `Welcome, ${name}.`,
    familyName: 'Family name',
    childName: "First child's name",
    timeZone: 'Time zone',
    weekStart: 'Week starts on',
    monday: 'Monday',
    sunday: 'Sunday',
    starter: 'Start with a sample list of behaviors and rewards',
    create: 'Create',
    signOut: 'Sign out',
  },

  // Toast and history descriptions
  undo: 'Undo',
  undoLower: 'undo',
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
  },

  // Settings tab
  settings: {
    family: 'Family',
    familyName: 'Family name',
    timeZone: 'Time zone',
    weekStart: 'Week starts on',
    monday: 'Monday',
    sunday: 'Sunday',
    save: 'Save',
    children: 'Children',
    child: 'child',
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

    // Edit form
    formEdit: 'Edit',
    formAdd: 'Add',
    reward: 'reward',
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
};
