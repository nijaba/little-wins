// Little Wins front end. No inline script, style or handlers: the page is served under a strict
// Content Security Policy. Markup is generated as strings; clicks are handled by delegation on
// elements carrying data-action, and dynamic widths are applied after rendering.
// Text comes from strings.<lang>.js (English is loaded with the page; others on demand).
(() => {
  // Languages the app speaks, each named in its own language for the choice in Settings.
  const LANGS = { en: 'English', zh: '中文（简体）', es: 'Español', fr: 'Français', de: 'Deutsch' };
  let lang = 'en';
  let STR = window.LW_STRINGS.en;

  let S = null; // last state received from the server
  let tab = 'today'; // selected tab
  let wkSel = null; // week start being viewed, or null for the current week
  let ed = null; // item or reward being edited, or null
  const op = {}; // which settings sections are open, remembered across renders
  let chSel = null; // child id being viewed by a parent, or null for the first child
  let cfg = { appName: STR.appName, providers: [] }; // public config, for the signed-out screen
  let screen = 'out'; // 'app' while the signed-in state is shown
  let etag = null; // ETag of the last state for this selection (see poll)
  let etagKey = ''; // the selection (week/child) that ETag belongs to
  let gen = 0; // bumped on every state change, so a slow poll reply is dropped
  let notice = ''; // one-time message on the signed-out screen
  let ops = null; // operator numbers, once loaded
  let opsErr = false;
  let delTxt = ''; // what was typed in the "delete family" box
  let iss = null; // device code or invite link just issued, shown until Done
  let rev = null; // the weekly review on show (parents, Week tab), or null
  let cdTimer; // countdown of the device code
  let tour = null; // the guided tour while it runs: { role, steps, i, shown, back }
  try {
    chSel = +localStorage.getItem('child') || null;
  } catch {}

  const $ = (id) => document.getElementById(id);
  const P = () => S.role === 'parent';

  // ---- Language ----

  // A translation over English, key by key, so anything it leaves out stays in English.
  const merge = (base, over) => {
    const out = { ...base };
    for (const [k, v] of Object.entries(over || {})) {
      const nested = (x) => x && typeof x === 'object' && !Array.isArray(x);
      out[k] = nested(v) && nested(base[k]) ? merge(base[k], v) : v;
    }
    return out;
  };

  // The first language the browser asks for that the app speaks; English otherwise.
  const browserLang = () =>
    (navigator.languages?.length ? navigator.languages : [navigator.language])
      .map(
        (l) =>
          String(l || '')
            .toLowerCase()
            .split('-')[0],
      )
      .find((l) => Object.hasOwn(LANGS, l)) || 'en';

  // The family's language once known; before that (sign-in, pairing, setup) the browser's.
  const wantedLang = () => S?.family?.language || browserLang();

  // Load strings.<lang>.js once, by a script element (same origin, so the CSP allows it).
  const loading = {};
  function loadLang(l) {
    if (l === 'en' || window.LW_STRINGS[l]) return Promise.resolve();
    if (!loading[l]) {
      loading[l] = new Promise((done) => {
        const el = document.createElement('script');
        el.src = `strings.${l}.js`;
        el.onload = done;
        el.onerror = () => {
          delete loading[l]; // try again next time; English meanwhile
          done();
        };
        document.head.appendChild(el);
      });
    }
    return loading[l];
  }

  // Switch to a language (unknown codes mean English). Resolves once its text is in place.
  async function useLang(l) {
    const want = Object.hasOwn(LANGS, l) ? l : 'en';
    if (want === lang) return;
    await loadLang(want);
    lang = want;
    STR = merge(window.LW_STRINGS.en, window.LW_STRINGS[want]);
    document.documentElement.lang = STR.locale;
  }

  // Dates in the family's language. `day` is a calendar date (YYYY-MM-DD); `ts` is a time.
  const fmt = (date, opts) => {
    try {
      return new Intl.DateTimeFormat(STR.locale, opts).format(date);
    } catch {
      return date.toLocaleString();
    }
  };
  const fmtDay = (day, opts) => fmt(new Date(`${day}T12:00:00Z`), { ...opts, timeZone: 'UTC' });
  const fmtTs = (ts, opts) => {
    const tz = S?.family?.timezone;
    try {
      return fmt(new Date(ts), { ...opts, ...(tz ? { timeZone: tz } : {}) });
    } catch {
      return fmt(new Date(ts), opts);
    }
  };
  const fmtNum = (n) => {
    try {
      return new Intl.NumberFormat(STR.locale).format(n);
    } catch {
      return String(n);
    }
  };

  // The text of an API error: translated by its code, else the server's English text.
  const errText = (j, fallback = STR.login.networkError) => {
    const e = j?.code && STR.errors[j.code];
    return (typeof e === 'function' ? e(j) : e) || j?.error || fallback;
  };

  // Escape every user-entered string before it reaches the page.
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
    );

  // Query string that keeps the selected week and child on every API call.
  const wq = () => {
    const q = [];
    if (wkSel) q.push(`week=${wkSel}`);
    // Before the first state arrives we don't know the role yet: ask for the remembered child
    // anyway (a child's device always gets its own child, whatever is asked).
    if (chSel && S?.role !== 'child') q.push(`child=${chSel}`);
    return q.length ? `?${q.join('&')}` : '';
  };

  const post = (path, body) =>
    fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });

  // Privacy and Terms links, for the pages that are set in the public config.
  // "Ask for a place": the operator's contact (SIGNUP_CONTACT_URL), on the private and full screens.
  const contact = () =>
    cfg.contactUrl
      ? `<p><a class="b lnk" href="${esc(cfg.contactUrl)}">${STR.setup.askForPlace}</a></p>`
      : '';

  const legal = () => {
    const a = [
      [cfg.privacyUrl, STR.legal.privacy],
      [cfg.termsUrl, STR.legal.terms],
    ]
      .filter(([u]) => /^https?:\/\//i.test(u || ''))
      .map(([u, t]) => `<a href="${esc(u)}" target=_blank rel="noopener noreferrer">${t}</a>`);
    return a.length ? `<p class="center legal"><small>${a.join(' · ')}</small></p>` : '';
  };

  // ---- API ----

  // Take a state reply: remember the selection it shows and redraw.
  async function take(j) {
    S = j;
    gen++;
    await useLang(wantedLang());
    if (S !== j) return; // a newer state arrived while the language loaded
    if (S.setup) return renderSetup();
    wkSel = S.week.current ? null : S.week.start;
    if (P()) {
      chSel = S.childId;
      try {
        if (!S.demo) localStorage.setItem('child', String(chSel));
      } catch {}
    }
    render();
  }

  // Call the API; on success store the new state and redraw. Returns true on success.
  async function api(path, body) {
    const key = wq();
    const r = await fetch(`/api/${path}${key}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    if (!r) {
      alert(STR.login.networkError);
      return false;
    }
    if (r.status === 401) {
      const j = await r.json().catch(() => ({}));
      leaveScreen();
      await useLang(browserLang());
      if (j.code === 'demoEnded') notice = STR.demo.ended;
      login();
      return false;
    }
    const j = await r.json().catch(() => ({}));
    if (j.error || !r.ok) {
      alert(errText(j));
      return false;
    }
    // Writes return fresh state without an ETag; a state read gives the tag for polling.
    etag = body ? null : r.headers.get('ETag');
    etagKey = key;
    iss = j.issued ? { ...j.issued, type: path, child: body?.child_id } : iss;
    await take(j);
    return true;
  }

  function goWeek(w) {
    wkSel = w;
    api('state');
  }

  // ---- Signed-out screens ----

  // The signed-out screen. With an invite token it is the "Join <family>" screen instead.
  function login(invite, signup) {
    screen = 'out';
    clearInterval(cdTimer);
    const L = STR.login;
    const note = notice ? `<p class=note>${notice}</p>` : '';
    notice = '';
    const q = invite
      ? `?invite=${encodeURIComponent(invite.token)}`
      : signup?.ok
        ? `?signup=${encodeURIComponent(signup.token)}`
        : '';
    const btns = cfg.providers
      .map(
        (p) =>
          `<p><a class="b lnk" href="/auth/${esc(p)}/login${q}">${esc(L.signInWith[p] || p)}</a></p>`,
      )
      .join('');
    let h =
      signup || invite
        ? `<main class=center><h2>${esc(cfg.appName)}</h2>${note}`
        : `<main class="center landing">${welcome()}${note}`;
    if (signup) {
      h += signup.ok
        ? `<h3>${signup.full ? STR.setup.full : L.signupTitle}</h3>${signup.full ? contact() : `<p><small>${L.signupHelp}</small></p>${btns}`}<p><button class="b g" data-action=not-now>${L.notNow}</button></p>`
        : `<p class=err>${L.inviteInvalid}</p>${contact()}<p><button class="b g" data-action=not-now>${L.notNow}</button></p>`;
    } else if (invite) {
      h += invite.family
        ? `<h3>${L.joinTitle(esc(invite.family))}</h3><p><small>${L.joinHelp}</small></p>${btns}<p><button class="b g" data-action=not-now>${L.notNow}</button></p>`
        : `<p class=err>${L.inviteInvalid}</p><p><button class="b g" data-action=not-now>${L.notNow}</button></p>`;
    } else {
      h += tryCard();
      h += `<div class=card><h3 class=edit-title>${L.parentsOnly}</h3>${btns}</div><div class=card><h3 class=edit-title>${L.codeTitle}</h3><p><small>${L.codeHelp}</small></p><p><input id=code aria-label="${L.codeTitle}" autocapitalize=characters autocomplete=off autocorrect=off spellcheck=false placeholder="${L.codePlaceholder}"></p><p class=err id=err></p><p><button class=b data-action=pair-code>${L.codeButton}</button></p></div>`;
    }
    $('app').innerHTML = `${h}${legal()}</main>`;
  }

  // Try a demo and Watch the video, at the top of the sign-in screen when they are on.
  // The welcome at the top of the sign-in page: the star, the name, a tagline and three reasons.
  function welcome() {
    const W = STR.welcome;
    const stars = ['s1', 's2', 's3', 's4', 's5']
      .map((k) => `<span class="sparkle ${k}" aria-hidden=true>★</span>`)
      .join('');
    return `<section class=hero aria-label="${esc(cfg.appName)}">${stars}<img class=hero-logo src=icon.svg alt="" width=84 height=84><h1>${esc(cfg.appName)}</h1><p class=tagline>${W.tagline}</p><ul class=perks>${W.perks
      .map(([icon, text]) => `<li><span aria-hidden=true>${icon}</span> ${text}</li>`)
      .join('')}</ul></section>`;
  }

  function tryCard() {
    const D = STR.demo;
    const demo = cfg.demo
      ? `<p><button class="b w" data-action=demo-start>${D.tryButton}</button></p>`
      : '';
    const video = cfg.tourVideo
      ? `<p><button class="b${cfg.demo ? ' g' : ''}" data-action=video>${D.watchButton}</button></p>`
      : '';
    if (!demo && !video) return '';
    return `<div class="card try"><h3 class=edit-title>${cfg.demo ? D.tryTitle : D.videoTitle}</h3><p><small>${cfg.demo ? D.tryHelp : D.videoHelp}</small></p>${demo}${video}</div>`;
  }

  // Forget the signed-in screen's state (signing out, a deleted family, a demo left or ended).
  function leaveScreen() {
    const wasDemo = !!S?.demo;
    S = null;
    iss = null;
    ops = null;
    ed = null;
    closeTour();
    if (wasDemo) {
      tab = 'today';
      try {
        chSel = +localStorage.getItem('child') || null;
      } catch {
        chSel = null;
      }
    }
  }

  // ---- Demo families ----

  async function demoStart() {
    let timezone = '';
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {}
    const r = await post('demo/start', { timezone, language: lang }).catch(() => null);
    if (r?.ok) {
      tab = 'today';
      chSel = null;
      wkSel = null;
      return api('state');
    }
    const j = r ? await r.json().catch(() => ({})) : null;
    notice =
      j?.code === 'demoFull'
        ? `<span aria-hidden=true>☕</span> ${esc(errText(j))}`
        : esc(errText(j));
    login();
  }

  async function demoLeave() {
    await post('demo/leave').catch(() => {});
    leaveScreen();
    await useLang(browserLang());
    login();
  }

  // ---- Tour video ----

  function openVideo() {
    if ($('player')) return;
    const D = STR.demo;
    const box = document.createElement('div');
    box.id = 'player';
    box.className = 'player';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', D.videoLabel);
    box.innerHTML = `<div class=player-box><video src="/tour.mp4" controls autoplay playsinline preload=auto></video><p class=center><button class=b data-action=video-close>${D.closeVideo}</button></p></div>`;
    box.addEventListener('click', onClick);
    document.body.appendChild(box);
    box.querySelector('button').focus();
  }

  function closeVideo() {
    const box = $('player');
    if (!box) return;
    box.querySelector('video')?.pause();
    box.remove();
    document.querySelector('[data-action=video]')?.focus();
  }

  // ---- Guided tour ----
  // Drawn by the page alone: an outline around the part a step explains, and a caption.

  const TOUR = {
    parent: [
      { key: 'earn', tab: 'today', sel: '[data-tour=earn]' },
      { key: 'warn', tab: 'today', sel: '[data-tour=warn]' },
      { key: 'penalties', tab: 'today', sel: '[data-tour=penalties]' },
      { key: 'marks', tab: 'week', sel: '[data-tour=marks]' },
      { key: 'rewards', tab: 'rew', sel: '[data-tour=ring]' },
      { key: 'history', tab: 'hist', sel: '[data-tour=hist]' },
      { key: 'settings', tab: 'set', sel: '.tabs [data-tab=set]', fixed: true },
      { key: 'device', tab: 'set', sel: '[data-tour=device]', open: 'dev' },
    ],
    child: [
      { key: 'header', tab: 'today', sel: 'header' },
      { key: 'ring', tab: 'today', sel: '[data-tour=ring]' },
      { key: 'earn', tab: 'today', sel: '[data-tour=earn]' },
      { key: 'marks', tab: 'week', sel: '[data-tour=marks]' },
      { key: 'rewards', tab: 'rew', sel: '[data-tour=rewards]' },
    ],
  };
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // The once-only offer is answered (either way) per role on this device.
  const offerKey = () => `tour_${S.role}`;
  function offerAnswered() {
    try {
      return !!localStorage.getItem(offerKey());
    } catch {
      return true; // no storage: don't offer on every visit
    }
  }
  function answerOffer() {
    try {
      localStorage.setItem(offerKey(), '1');
    } catch {}
  }

  function startTour() {
    answerOffer();
    const role = P() ? 'parent' : 'child';
    tour = { role, steps: TOUR[role], i: 0, shown: -1, back: document.activeElement };
    goTour(0);
  }

  // Show step i: switch to its tab (and open its section), then draw.
  function goTour(i) {
    tour.i = Math.max(0, Math.min(tour.steps.length - 1, i));
    const st = tour.steps[tour.i];
    if (st.open) op[st.open] = true;
    tab = st.tab;
    ed = null;
    render(); // calls drawTour
  }

  function closeTour() {
    if (!tour) return;
    const back = tour.back;
    tour = null;
    drawTour();
    if (back?.isConnected) back.focus();
  }

  // Draw the current step, or clear the overlay when no tour runs. Called after every render.
  function drawTour() {
    const box = $('tour');
    if (!tour || screen !== 'app') {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    const T = STR.tour;
    const st = tour.steps[tour.i];
    const text = T[tour.role][st.key];
    const n = tour.steps.length;
    const last = tour.i === n - 1;
    const el = document.querySelector(st.sel);
    const fresh = tour.shown !== tour.i;
    tour.shown = tour.i;
    box.hidden = false;
    box.innerHTML = `<div class="tour-ring${st.fixed ? ' fixed' : ''}"></div><div class="tour-caption${captionOnTop(st, el) ? ' top' : ''}" role=dialog aria-labelledby=tour-t aria-describedby=tour-b tabindex=-1><p class=tour-n><small>${T.step(tour.i + 1, n)}</small></p><h3 id=tour-t>${text.t}</h3><p id=tour-b>${text.b}</p><div class=tour-btns><button class="b g" data-action=tour-close>${T.close}</button>${
      tour.i ? `<button class="b g" data-action=tour-back>${T.back}</button>` : ''
    }<button class=b data-action=${last ? 'tour-close' : 'tour-next'}>${last ? T.done : T.next}</button></div></div>`;
    const ring = box.querySelector('.tour-ring');
    if (!el) ring.hidden = true;
    else {
      if (fresh && !st.fixed)
        el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      placeRing();
    }
    if (fresh) box.querySelector('.tour-caption').focus({ preventScroll: true });
  }

  // The caption goes above when the part will sit in the lower half once scrolled to (the tabs,
  // or the end of the page), so it never covers it.
  function captionOnTop(st, el) {
    if (!el) return false;
    if (st.fixed) return true;
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const scroll = Math.max(0, Math.min(max, top - (window.innerHeight - r.height) / 2));
    return top + r.height / 2 - scroll > window.innerHeight * 0.55;
  }

  // Put the outline around the step's part (page coordinates, or the viewport for fixed parts).
  function placeRing() {
    const ring = $('tour').querySelector('.tour-ring');
    const st = tour?.steps[tour.i];
    const el = st && document.querySelector(st.sel);
    if (!ring || !el) return;
    const r = el.getBoundingClientRect();
    const dx = st.fixed ? 0 : window.scrollX;
    const dy = st.fixed ? 0 : window.scrollY;
    ring.style.left = `${r.left + dx - 4}px`;
    ring.style.top = `${r.top + dy - 4}px`;
    ring.style.width = `${r.width + 8}px`;
    ring.style.height = `${r.height + 8}px`;
  }

  // Redeem a pairing code; on success load the child's state.
  async function redeem(code) {
    const r = await post('pair', { code }).catch(() => null);
    if (r?.ok) return api('state');
    const j = r ? await r.json().catch(() => ({})) : {};
    const msg = errText(j, STR.login.codeFailed);
    if (!$('err')) login(); // opened from a #pair= link: show the sign-in screen first
    $('err').textContent = msg;
    return false;
  }

  async function showSignup(token) {
    const r = await post('signup/info', { token }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => ({})) : {};
    login(null, { token, ok: !!j.ok, full: !!j.full });
  }

  async function showInvite(token) {
    const r = await post('invite/info', { token }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => ({})) : {};
    login({ token, family: j.familyName || '' });
  }

  async function logout() {
    await post('logout').catch(() => {});
    leaveScreen();
    await useLang(browserLang());
    login();
  }

  // Delete the family (owner only): ask once more, then show the signed-out screen.
  async function delFamily() {
    const st = STR.settings;
    if ($('del_name').value.trim() !== S.family.name || !confirm(st.confirmDeleteFamily)) return;
    const r = await post('family/delete', { confirm: $('del_name').value }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok && j.deleted) {
      leaveScreen();
      delTxt = '';
      tab = 'today';
      for (const k of Object.keys(op)) delete op[k];
      await useLang(browserLang());
      notice = STR.login.familyDeleted;
      login();
    } else alert(errText(r ? j : null));
  }

  // ---- Operator numbers ----

  const opsHtml = () => {
    const o = STR.operator;
    if (opsErr) return `<p class=err>${o.failed}</p>`;
    if (!ops) return `<p><small>${o.loading}</small></p>`;
    const row = (k, v) => `<div class=row><div>${k}</div><div><b>${v}</b></div></div>`;
    return `<div class=card>${[
      [o.families, ops.familyLimit ? o.ofLimit(ops.families, ops.familyLimit) : ops.families],
      [o.idleAfter, ops.idleFamilyDays ? o.days(ops.idleFamilyDays) : o.never],
      [o.unclaimedFamilies, ops.unclaimedFamilies],
      [o.parents, ops.parents],
      [o.children, ops.children],
      [o.devices, ops.devices],
      [o.activeDevices30d, ops.activeDevices30d],
      [o.entries, ops.entries],
      [o.dbSize, o.mb((ops.dbBytes / 1048576).toFixed(1))],
      [o.version, esc(ops.version)],
      [o.uptime, o.duration(ops.uptimeSeconds)],
    ]
      .map(([k, v]) => row(k, v))
      .join('')}</div>${opsInvites()}`;
  };

  // Family invites (SIGNUP_MODE=invite): issue a link, list the open ones, cancel one.
  const opsInvites = () => {
    if (ops.signupMode !== 'invite') return '';
    const o = STR.operator;
    let h = `<h3>${o.familyInvites}</h3><p><small>${o.familyInvitesHelp}</small></p>`;
    if (iss?.type === 'operator/invite/create') {
      h += issuedBox(o.familyInviteTitle, o.familyInviteHelp, '', o.familyInviteExpires);
    } else {
      h += `<p><button class=b data-action=fam-invite>${o.inviteFamily}</button></p>`;
    }
    for (const i of ops.familyInvites || []) {
      h += `<div class=card><div class="row stk"><div>${STR.settings.inviteSent(fmtTs(i.created, { dateStyle: 'medium' }))}<br><small>${STR.settings.inviteUntil(fmtTs(i.expires, { dateStyle: 'medium' }))}</small></div><div><button class="b g" data-action=fam-invite-cancel data-id=${i.id}>${STR.settings.cancelInvite}</button></div></div></div>`;
    }
    return h;
  };

  // Operator writes answer with the numbers again; show them, and any link just issued.
  async function opsPost(path, body) {
    const r = await post(path, body).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (!j) return toast(STR.errors.serverError);
    ops = j;
    if (j.issued) iss = { ...j.issued, type: path };
    if ($('ops-body')) $('ops-body').innerHTML = opsHtml();
  }

  // Load the numbers and show them in #ops-body (not a full render: keeps sections open).
  async function loadOps() {
    const r = await fetch('/api/operator').catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    ops = j;
    opsErr = !j;
    if ($('ops-body')) $('ops-body').innerHTML = opsHtml();
  }

  // Week start as a pair of radio buttons in a fieldset (1 = Monday, 0 = Sunday).
  const weekRadios = (name, st, value) =>
    `<fieldset class=radios><legend>${st.weekStart}</legend><label><input type=radio name=${name} value=1${
      value ? ' checked' : ''
    }> ${st.monday}</label> <label><input type=radio name=${name} value=0${value ? '' : ' checked'}> ${st.sunday}</label></fieldset>`;

  // The language choice: radio buttons (a <select> inserted as HTML trips WebKit's CSP check).
  const langRadios = (name, label, value) =>
    `<fieldset class="radios langs"><legend>${label}</legend>${Object.entries(LANGS)
      .map(
        ([code, own]) =>
          `<label lang=${code}><input type=radio name=${name} value=${code}${code === value ? ' checked' : ''}> ${own}</label>`,
      )
      .join(' ')}</fieldset>`;

  // ---- Setup ----

  let draft = null; // setup fields kept while the page switches language

  function renderSetup() {
    screen = 'out';
    const st = STR.setup;
    if (S.operator && !S.canCreate) {
      const o = STR.operator;
      $('app').innerHTML =
        `<main><h2 class=center>${o.title}</h2><p class=center><small>${o.help}</small></p><div id=ops-body>${opsHtml()}</div><p class=center><button class=b data-action=ops-refresh>${o.refresh}</button> <button class="b g" data-action=logout>${st.signOut}</button></p>${legal()}</main>`;
      loadOps();
      return;
    }
    if (!S.canCreate) {
      $('app').innerHTML =
        `<main class=center><h2>${esc(cfg.appName)}</h2><p>${S.full ? st.full : st.private}</p>${contact()}<p><button class="b g" data-action=logout>${st.signOut}</button></p>${legal()}</main>`;
      return;
    }
    let tz = '';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {}
    const d = draft || { family: '', child: '', tz, week: 1, starter: true };
    draft = null;
    const f = (id, label, v, max) =>
      `<p><label for=${id}>${label}</label><br><input id=${id} maxlength=${max} value="${esc(v)}"></p>`;
    $('app').innerHTML =
      `<main><h2 class=center>${st.title}</h2><div class=card><p class=p0>${S.me?.name ? st.hello(esc(S.me.name)) : ''}</p>${f('s_family', st.familyName, d.family, 60)}${f('s_child', st.childName, d.child, 40)}${f('s_tz', st.timeZone, d.tz, 60)}${weekRadios('s_week', st, d.week)}${langRadios('s_lang', st.language, lang)}<p><label class=chk><input id=s_starter type=checkbox${d.starter ? ' checked' : ''}> ${st.starter}</label></p><button class=b data-action=do-setup>${st.create}</button></div><p class=center><button class="b g" data-action=logout>${st.signOut}</button></p>${legal()}</main>`;
  }

  // Picking a language during setup shows the page in it right away, keeping what was typed.
  async function setupLang(l) {
    draft = {
      family: $('s_family').value,
      child: $('s_child').value,
      tz: $('s_tz').value,
      week: +document.querySelector('input[name=s_week]:checked').value,
      starter: $('s_starter').checked,
    };
    await useLang(l);
    renderSetup();
  }

  function doSetup() {
    api('setup', {
      family_name: $('s_family').value,
      child_name: $('s_child').value,
      timezone: $('s_tz').value,
      week_start: +document.querySelector('input[name=s_week]:checked').value,
      starter: $('s_starter').checked,
      language: document.querySelector('input[name=s_lang]:checked')?.value || lang,
    });
  }

  // ---- Toast and celebration ----

  let toastTimer;
  const hideToast = () => {
    $('toast').style.display = 'none';
  };

  function toast(m, id, noted) {
    const t = $('toast');
    t.innerHTML =
      `<span>${esc(m)}</span>` +
      (noted
        ? `<button class="b g" data-action=toast-note data-id=${id}>${STR.note}</button>`
        : '') +
      (id ? `<button class="b g" data-action=toast-undo data-id=${id}>${STR.undo}</button>` : '');
    t.style.display = 'flex';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }

  // Does the device ask for less motion? Celebrations then show without moving.
  const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function party(name) {
    const p = $('party');
    p.innerHTML = `<div class=party-card><span>🎉</span>${STR.party.unlocked}<br><b>${esc(name)}</b></div>`;
    // Confetti: pieces placed and timed at random (through the DOM: the CSP allows no style=).
    if (!still()) {
      for (let k = 0; k < 28; k++) {
        const c = document.createElement('i');
        c.className = `confetti c${k % 5}`;
        c.style.left = `${Math.random() * 100}%`;
        c.style.animationDelay = `${Math.random() * 0.6}s`;
        c.style.animationDuration = `${2 + Math.random() * 1.4}s`;
        p.appendChild(c);
      }
    }
    p.style.display = 'flex';
    setTimeout(() => {
      p.style.display = 'none';
    }, 7000);
  }

  // On a child's device: when points arrived since the child last looked, count up to the new
  // balance in the header (remembered per child on this device; still with reduced motion).
  function countUp() {
    if (P() || !S.childId) return;
    const key = `bal_${S.demo ? 'demo_' : ''}${S.childId}`;
    let from = null;
    try {
      from = localStorage.getItem(key);
      localStorage.setItem(key, String(S.balance));
    } catch {}
    from = from === null ? null : Number(from);
    if (from === null || !(from < S.balance) || still()) return;
    const to = S.balance;
    const start = performance.now();
    const step = (now) => {
      const el = $('hdr');
      if (!el) return;
      const t = Math.min(1, (now - start) / 900);
      const v = Math.round(from + (to - from) * (1 - (1 - t) ** 3));
      el.textContent = STR.header(fmtNum(v), fmtNum(S.stars));
      el.classList.toggle('counting', t < 1);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Celebrate rewards unlocked since the last render on this device (remembered per role).
  function celebrate() {
    try {
      const ids = myRewards()
        .filter((r) => S.stars >= r.stars && S.balance >= r.points)
        .map((r) => r.id);
      const k = `seen_${S.demo ? 'demo_' : ''}${S.role}_${S.childId}`;
      const seen = JSON.parse(localStorage.getItem(k) || 'null');
      localStorage.setItem(k, JSON.stringify(ids));
      if (!seen) return; // first visit: nothing is "new"
      const fresh = myRewards().filter((r) => ids.includes(r.id) && !seen.includes(r.id));
      if (fresh.length) party(fresh[0].name);
    } catch {}
  }

  // A behavior's, reward's or child's emoji, before its name (none: nothing).
  const emo = (x) => (x?.emoji ? `<span class=emo aria-hidden=true>${esc(x.emoji)}</span>` : '');
  const named = (x) => `${emo(x)}${esc(x.name)}`;

  // Items and rewards can be for some children only (`for`: null = everyone).
  const mine = (r) => r.for == null || r.for.includes(S.childId);
  const myRewards = () => S.rewards.filter(mine);
  // "For: Mia, Leo" under an item or reward that isn't for everyone (Settings).
  const forLabel = (r) => {
    if (r.for == null) return '';
    const names = S.children.filter((c) => r.for.includes(c.id)).map((c) => esc(c.name));
    return ` · ${STR.settings.forLabel(names.length ? names.join(', ') : STR.settings.forNobody)}`;
  };

  // ---- Actions ----

  const desc = (e) =>
    e.kind === 'points'
      ? `${(e.points > 0 ? '+' : '') + e.points} · ${e.name}`
      : e.kind === 'warn'
        ? STR.warningPrefix + e.name
        : `${e.name}: ${STR.history.markNames[e.note] || e.note}`;

  // Call the API, then toast the newest history entry with an Undo button.
  async function act(path, body) {
    const e = (await api(path, body)) && S.hist[0];
    if (e) toast(desc(e), e.id, notable(e));
  }

  // Points (penalties too) and warnings can carry a note for parents; a mark cannot.
  const notable = (e) => e.kind === 'points' || e.kind === 'warn';

  // Ask for an entry's note (prefilled); an empty answer clears it, Cancel changes nothing.
  function note(id) {
    const e = S.hist.find((x) => x.id === id);
    const text = prompt(STR.notePrompt, e?.note || '');
    if (text !== null) api('entry/note', { id, note: text });
  }

  // Tap-to-cycle a challenge mark: none -> perfect -> ok -> bad -> perfect.
  function cyc(id, k) {
    const c = S.week.marks[id][k];
    act('mark', {
      child_id: S.childId,
      item_id: id,
      mark: { null: 'perfect', perfect: 'ok', ok: 'bad', bad: 'perfect' }[c],
      day: S.week.days[k],
    });
  }

  function add(id) {
    const i = S.items.find((x) => x.id === id);
    let p;
    if (i.pmin !== i.pmax) {
      p = prompt(STR.today.promptPoints(i.pmin, i.pmax), i.pmin);
      if (p === null) return;
    }
    floatPoints(id, i.pmin === i.pmax ? i.pmin : Math.min(i.pmax, Math.max(i.pmin, +p || i.pmin)));
    act('add', { child_id: S.childId, item_id: id, points: p });
  }

  // A small "+5" that floats up from the + button a parent tapped.
  function floatPoints(id, n) {
    const btn = document.querySelector(`[data-action=add][data-id="${id}"]`);
    if (!btn || still()) return;
    const r = btn.getBoundingClientRect();
    const f = document.createElement('span');
    f.className = 'plus-float';
    f.textContent = `+${fmtNum(n)}`;
    f.style.left = `${r.left + r.width / 2}px`;
    f.style.top = `${r.top}px`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }

  function pen(id) {
    const i = S.items.find((x) => x.id === id);
    if (i && confirm(STR.today.confirmPenalty(i.name)))
      act('add', { child_id: S.childId, item_id: id });
  }

  // Open the edit form: t is 'i' (item) or 'r' (reward); id 0 means a new one.
  function edit(t, id, kind) {
    const l = t === 'r' ? S.rewards : t === 'c' ? S.children : S.items;
    ed = id
      ? { ...l.find((x) => x.id === id), t, kind }
      : { t, kind, name: '', note: '', pmin: 5, pmax: 5, stars: 12, points: 0 };
    render();
  }

  async function saveEd() {
    const g = (k) => $(k)?.value || '';
    const r = ed.t === 'r';
    let path = 'item/save';
    let body = {
      id: ed.id,
      kind: ed.kind,
      name: g('f_name'),
      note: g('f_note'),
      pmin: g('f_min'),
      pmax: ed.kind === 'target' ? g('f_max') : g('f_min'),
    };
    // Who it is for, when there is a choice: every child ticked means everyone.
    if (S.children.length > 1) {
      const ticked = [...document.querySelectorAll('input[name=f_for]:checked')].map(
        (x) => +x.value,
      );
      body.children = ticked.length === S.children.length ? null : ticked;
    }
    if (ed.t === 'c') {
      path = 'child/save';
      body = { id: ed.id || undefined, name: g('f_name') };
    } else if (r) {
      path = 'reward/save';
      body = {
        id: ed.id,
        name: g('f_name'),
        stars: g('f_stars'),
        points: g('f_points'),
        children: body.children,
      };
    }
    body.emoji = $('f_emoji') ? $('f_emoji').value : undefined;
    if (await api(path, body)) {
      ed = null;
      render();
    }
  }

  const mv = (t, id, d) => api(`${t}/move`, { id, dir: d });

  function delItem(id) {
    if (confirm(STR.settings.confirmRemoveItem)) api('item/delete', { id });
  }

  function delRew(id) {
    if (confirm(STR.settings.confirmRemoveReward)) api('reward/delete', { id });
  }

  function revoke(id, me) {
    if (confirm(me ? STR.settings.confirmLogOutMe : STR.settings.confirmLogOutOther))
      api('session/revoke', { id });
  }

  // data-action name -> handler; d is the element's dataset.
  const actions = {
    'pair-code': () => redeem($('code').value),
    'demo-start': () => demoStart(),
    'demo-leave': () => demoLeave(),
    'demo-view': () => api('demo/view', { as: P() ? 'child' : 'parent', child_id: S.childId }),
    video: () => openVideo(),
    'video-close': () => closeVideo(),
    tour: () => startTour(),
    'tour-no': () => {
      answerOffer();
      render();
    },
    'tour-next': () => goTour(tour.i + 1),
    'tour-back': () => goTour(tour.i - 1),
    'tour-close': () => closeTour(),
    'not-now': () => {
      history.replaceState(null, '', location.pathname);
      api('state');
    },
    'do-setup': () => doSetup(),
    'del-family': () => delFamily(),
    'ops-refresh': () => {
      if ($('ops-body')) $('ops-body').innerHTML = `<p><small>${STR.operator.loading}</small></p>`;
      loadOps();
    },
    logout: () => logout(),
    child: (d) => {
      chSel = +d.id;
      rev = null;
      api('state');
    },
    'save-family': () =>
      api('family/save', {
        name: $('f_fam').value,
        timezone: $('f_tz').value,
        week_start: +document.querySelector('input[name=f_week]:checked').value,
        language: document.querySelector('input[name=f_lang]:checked')?.value,
      }),
    'del-child': (d) => {
      const c = S.children.find((x) => x.id === +d.id);
      if (c && confirm(STR.settings.confirmDeleteChild(c.name))) api('child/delete', { id: c.id });
    },
    'make-owner': (d) => {
      const p = S.parents.find((x) => x.id === +d.id);
      if (p && confirm(STR.settings.confirmMakeOwner(p.name)))
        api('owner/transfer', { user_id: p.id });
    },
    'rm-parent': (d) => {
      const p = S.parents.find((x) => x.id === +d.id);
      if (p && confirm(STR.settings.confirmRemoveParent(p.name)))
        api('parent/remove', { user_id: p.id });
    },
    invite: () => {
      iss = null;
      api('invite/create', {});
    },
    'cancel-invite': (d) => api('invite/revoke', { id: +d.id }),
    'fam-invite': () => {
      iss = null;
      opsPost('operator/invite/create');
    },
    'fam-invite-cancel': (d) => opsPost('operator/invite/revoke', { id: +d.id }),
    'pair-dev': (d) => {
      iss = null;
      api('pairing/create', { child_id: +d.id });
    },
    copy: async () => {
      try {
        await navigator.clipboard.writeText(iss.link);
        toast(STR.settings.copied);
      } catch {}
    },
    share: () => navigator.share({ url: iss.link }).catch(() => {}),
    done: () => {
      // An operator's family invite lives in the operator panel: redraw just that.
      const operatorLink = iss?.type?.startsWith('operator/');
      iss = null;
      if (operatorLink && $('ops-body')) $('ops-body').innerHTML = opsHtml();
      else render();
    },
    tab: (d) => {
      tab = d.tab;
      rev = null;
      render();
    },
    review: () => openReview(S.week.start),
    'review-week': (d) => openReview(d.week),
    'review-close': () => {
      rev = null;
      render();
    },
    print: () => window.print(),
    week: (d) => goWeek(d.week || null),
    cyc: (d) => cyc(+d.id, +d.k),
    add: (d) => add(+d.id),
    warn: (d) => act('warn', { child_id: S.childId, item_id: +d.id }),
    pen: (d) => pen(+d.id),
    undo: (d) => api('undo', { id: +d.id }),
    'toast-undo': (d) => {
      api('undo', { id: +d.id });
      hideToast();
    },
    note: (d) => note(+d.id),
    'rem-on': () => reminderOn(),
    // Pick an emoji in the edit form without redrawing it (keeps what was typed).
    'pick-emoji': (d) => {
      $('f_emoji').value = d.e;
      for (const b of document.querySelectorAll('.emj'))
        b.classList.toggle('on', b.dataset.e === d.e);
    },
    'child-notices': () => childNoticesOn(),
    notify: (d) => api('child/notify', { child_id: +d.id, on: d.on === '1' }),
    'rem-off': () => reminderOff(),
    msg: () => writeMessage(),
    'msg-clear': () => api('message', { child_id: S.childId, text: '' }),
    'toast-note': (d) => {
      hideToast();
      note(+d.id);
    },
    edit: (d) => edit(d.t, +d.id, d.kind),
    'save-ed': () => saveEd(),
    'cancel-ed': () => {
      ed = null;
      render();
    },
    mv: (d) => mv(d.t, +d.id, +d.dir),
    'del-item': (d) => delItem(+d.id),
    'del-rew': (d) => delRew(+d.id),
    revoke: (d) => revoke(+d.id, d.me === '1'),
  };

  function onClick(e) {
    const el = e.target.closest('[data-action]');
    const fn = el && actions[el.dataset.action];
    if (fn) fn(el.dataset);
  }

  // ---- Rendering ----

  const ago = (t) => {
    const m = (Date.now() - Date.parse(t)) / 6e4;
    return m < 10
      ? STR.ago.justNow
      : m < 90
        ? STR.ago.min(Math.round(m))
        : m < 2160
          ? STR.ago.hours(Math.round(m / 60))
          : STR.ago.days(Math.round(m / 1440));
  };

  // A folded Settings section; `k` is the key remembered in `op`.
  const fold = (k, t, n, body) =>
    `<details class=fold data-key="${k}" ${op[k] ? 'open' : ''}><summary><span>${t}</span><span class=cnt>${n}</span></summary>${body}</details>`;

  // Progress bar; the width is applied after rendering (see applyWidths).
  const bar = (a, b) =>
    `<div class=bar><i data-w="${Math.min(100, b ? (100 * a) / b : 100)}"></i></div>`;

  // ▲ ▼ buttons for item x of n.
  const mvb = (t, id, x, n) =>
    (x
      ? `<button class="b g" data-action=mv data-t=${t} data-id=${id} data-dir=-1>${STR.settings.up}</button> `
      : '') +
    (x < n - 1
      ? `<button class="b g" data-action=mv data-t=${t} data-id=${id} data-dir=1>${STR.settings.down}</button> `
      : '');

  // Points range text for an item, e.g. "5 pts" or "3-8 pts".
  const range = (i) => (i.pmin === i.pmax ? `${i.pmin} ${STR.pts}` : STR.ptsRange(i.pmin, i.pmax));

  // Progress ring toward the next locked reward.
  function ring() {
    const r = myRewards().find((x) => !(S.stars >= x.stars && S.balance >= x.points));
    if (!r) return `<div class="card center" data-tour=ring>${STR.ring.allUnlocked}</div>`;
    const a = Math.min(1, S.stars / (r.stars || 1));
    const b = r.points ? Math.min(1, S.balance / r.points) : a;
    const pc = Math.round(100 * (r.stars && r.points ? (a + b) / 2 : r.points ? b : a));
    const C = 264;
    // Almost there (90% or more): the ring glows.
    return `<div class="card ringcard${pc >= 90 ? ' near' : ''}" data-tour=ring><svg width=96 height=96 viewBox="0 0 100 100"><circle class=ring-track cx=50 cy=50 r=42 fill=none stroke="#dde" stroke-width=10 /><circle class=ring-value cx=50 cy=50 r=42 fill=none stroke="#2a7f8e" stroke-width=10 stroke-linecap=round stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pc / 100)}" transform="rotate(-90 50 50)"/><text class=ring-text x=50 y=57 text-anchor=middle font-size=22 font-weight=700 fill="#1f3a5f">${pc}%</text></svg><div><small>${STR.ring.next}</small><br><b>${named(r)}</b><br><small>${S.stars}/${r.stars} ${STR.star}${r.points ? ` · ${S.balance}/${r.points} ${STR.ring.pts}` : ''}</small></div></div>`;
  }

  // A parent's message and the milestones the app spotted: at the top of Today, for both views.
  function cheers() {
    const E = STR.cheer;
    let h = '';
    // A child's device: offer notices once a parent allowed them.
    const N = S.notices;
    if (N?.allowed && !N.on && N.key && pushOK() && Notification.permission !== 'denied') {
      h += `<div class="card msg"><p class=p0>🔔 ${STR.notices.offer}</p><p class=p8><button class=b data-action=child-notices>${STR.notices.turnOn}</button></p></div>`;
    }
    const m = S.message;
    if (m) {
      h += `<div class="card msg"><p class=p0>💬 ${esc(m.text)}</p><small>${E.from(esc(m.who))}</small>${
        P()
          ? `<p class=p8><button class="b g" data-action=msg>${E.change}</button> <button class="b g" data-action=msg-clear>${E.clear}</button></p>`
          : ''
      }</div>`;
    } else if (P()) {
      h += `<p class=hint><button class="b g" data-action=msg>${E.write(esc(S.childName))}</button></p>`;
    }
    const ms = (S.milestones || []).map((x) =>
      x.kind === 'streak' ? E.streak(x.days) : x.kind === 'best' ? E.best : '',
    );
    if (ms.length)
      h += `<div class=cheers>${ms.map((t) => `<span class=cheer>${t}</span>`).join('')}</div>`;
    return h;
  }

  // Write, change or (with an empty answer) clear the chosen child's message.
  function writeMessage() {
    const text = prompt(STR.cheer.prompt(S.childName), S.message?.text || '');
    if (text !== null) api('message', { child_id: S.childId, text });
  }

  function viewToday() {
    let h = cheers();
    if (!P()) h += ring();
    h += `<h3>${P() ? STR.today.earn : STR.today.waysToEarn}</h3>`;
    S.items
      .filter((x) => x.kind === 'target' && mine(x))
      .forEach((i, n) => {
        const t = (name) => (n ? '' : ` data-tour=${name}`); // the tour points at the first one
        h += `<div class=card${t('earn')}><div class=row><div>${named(i)}<br><small>${i.note ? `${esc(i.note)} · ` : ''}${range(i)}</small></div>${
          P()
            ? `<div><button class=b data-action=add data-id=${i.id}>+</button> <button class="b w" data-action=warn data-id=${i.id}${t('warn')}>${STR.today.warnButton(S.warn[i.id] || 0)}</button></div>`
            : ''
        }</div></div>`;
      });
    if (P()) {
      h += `<div data-tour=penalties><h3>${STR.today.penalties}</h3>`;
      for (const i of S.items.filter((x) => x.kind === 'penalty' && mine(x))) {
        h += `<div class=card><div class=row><div>${named(i)}<br><small>${esc(i.note)}</small></div><button class="b r" data-action=pen data-id=${i.id}>-${i.pmin}</button></div></div>`;
      }
      h += '</div>';
    }
    return h;
  }

  // The weekly review: load one week of the chosen child, then show it.
  async function openReview(week) {
    const r = await fetch(
      `/api/review?child=${S.childId}&week=${encodeURIComponent(week || '')}`,
    ).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => null) : null;
    if (!j) return toast(STR.errors.serverError);
    rev = j;
    render();
    window.scrollTo(0, 0);
  }

  function viewReview() {
    const R = STR.review;
    const wk = STR.week;
    const fd = (d, o = { month: 'short', day: 'numeric' }) => fmtDay(d, o);
    const range = `${fd(rev.days[0])} – ${fd(rev.days[6])}`;
    const w = rev.week;
    const stat = (label, value) =>
      `<div class=row><div>${label}</div><div><b>${value}</b></div></div>`;
    let h = `<div class="card wnav noprint"><button class="b g" ${rev.prev ? `data-action=review-week data-week="${rev.prev}"` : 'disabled'} aria-label="${wk.prevLabel}">‹</button><div><b>${rev.current ? wk.thisWeek : wk.weekOf(fd(rev.start))}</b><br><small>${range}</small></div><button class="b g" ${rev.next ? `data-action=review-week data-week="${rev.next}"` : 'disabled'} aria-label="${wk.nextLabel}">›</button></div>`;
    h += `<h3>${R.title(esc(rev.child.name))}</h3><p class=hint><small>${range}</small></p>`;
    h += `<div class=card>${stat(R.stars, `${w.stars} ${STR.star}`)}${stat(R.earned, `+${w.earned}`)}${stat(R.lost, w.lost ? `−${w.lost}` : '0')}${stat(R.warnings, w.warnings)}${stat(R.perfectDays, w.perfectDays)}${stat(R.badDays, w.badDays)}</div>`;
    const most = Math.max(1, ...rev.byDay.map((d) => d.earned));
    h += `<h3>${R.byDay}</h3><div class=card>${rev.byDay
      .map(
        (d) =>
          `<div class="row rv-day"><div class=rv-d>${fd(d.day, { weekday: 'short', day: 'numeric' })}</div><div class=rv-bar><div class=bar><i data-w=${Math.round((100 * d.earned) / most)}></i></div></div><div class=rv-n><b>+${d.earned}</b>${d.lost ? ` <small>−${d.lost}</small>` : ''}</div></div>`,
      )
      .join('')}</div>`;
    if (rev.challenges.length) {
      h += `<h3>${R.challenges}</h3>`;
      for (const c of rev.challenges) {
        const strip = c.marks
          .map(
            (m, k) =>
              `<span class="d ${m || ''}">${fd(rev.days[k], { weekday: 'narrow' })}<br>${wk.marks[m] || wk.marks.none}</span>`,
          )
          .join('');
        h += `<div class=card><div class=row><div>${named(c)}</div>${c.won ? `<b>${wk.won}</b>` : ''}</div><div class=strip>${strip}</div></div>`;
      }
    }
    const list = (title, rows, fmt) =>
      rows.length
        ? `<h3>${title}</h3><div class=card>${rows.map((x) => `<div class=row><div>${esc(x.name)}</div><div><b>${fmt(x)}</b></div></div>`).join('')}</div>`
        : '';
    h += list(R.top, rev.top, (x) => `${R.times(x.times)} · +${x.points}`);
    h += list(R.warnedFor, rev.warnedFor, (x) => R.times(x.times));
    if (!w.earned && !w.lost && !w.warnings && !w.perfectDays && !w.badDays)
      h += `<p class=center><small>${R.none}</small></p>`;
    h += `<h3>${R.recent}</h3><div class="card rv-table"><table><thead><tr><th>${R.week}</th><th>${STR.star}</th><th>+</th><th>−</th><th>⚠</th></tr></thead><tbody>${rev.recent
      .map(
        (x) =>
          `<tr><td>${fd(x.start)}</td><td>${x.stars}</td><td>${x.earned}</td><td>${x.lost}</td><td>${x.warnings}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;
    h += `<p class="center noprint"><button class=b data-action=print>${R.print}</button> <button class="b g" data-action=review-close>${R.back}</button></p>`;
    return h;
  }

  function viewWeek() {
    const W = S.week;
    const fd = (d) => fmtDay(d, { month: 'short', day: 'numeric' });
    // Day letters in the family's language (the server's English letters as a fallback).
    let letters = W.lbl;
    try {
      const wd = new Intl.DateTimeFormat(STR.locale, { weekday: 'narrow', timeZone: 'UTC' });
      letters = W.days.map((d) => wd.format(new Date(`${d}T12:00:00Z`)));
    } catch {}
    const nw = Object.keys(S.won).length;
    const wk = STR.week;
    let h = `<div class="card wnav"><button class="b g" ${W.prev ? `data-action=week data-week="${W.prev}"` : 'disabled'} aria-label="${wk.prevLabel}">‹</button><div><b>${W.current ? wk.thisWeek : wk.weekOf(fd(W.days[0]))}</b><br><small>${fd(W.days[0])} – ${fd(W.days[6])}${nw ? wk.starsWon(nw) : ''}</small></div><button class="b g" ${W.next ? `data-action=week data-week="${W.next}"` : 'disabled'} aria-label="${wk.nextLabel}">›</button></div>`;
    if (!W.current)
      h += `<p class=back><button class="b g" data-action=week data-week="">${wk.back}</button></p>`;
    h += `<h3>${wk.challenges}</h3><small class=hint>${wk.rule}${P() ? wk.ruleParent : ''}</small>`;
    for (const [n, i] of S.items.filter((x) => x.kind === 'challenge' && mine(x)).entries()) {
      const m = W.marks[i.id] || [];
      const pf = m.filter((x) => x === 'perfect').length;
      const bd = m.includes('bad');
      const days = W.days
        .map((d, k) => {
          const v = m[k];
          const fut = d > S.today;
          const sym = wk.marks[v] || wk.marks.none;
          const label = `${esc(letters[k])} ${+d.slice(8)}<br>${sym}`;
          return P() && !fut
            ? `<button class="d ${v || ''}" data-action=cyc data-id=${i.id} data-k=${k}>${label}</button>`
            : `<span class="d ${v || ''}${fut ? ' fut' : ''}">${label}</span>`;
        })
        .join('');
      h += `<div class=card${n ? '' : ' data-tour=marks'}><div class=row><div>${named(i)}<br><small>${
        S.won[i.id] ? '' : wk.perfectDays(pf) + (bd ? wk.aBadDay : '')
      }</small></div>${S.won[i.id] ? `<b>${wk.won}</b>` : ''}</div><div class=strip>${days}</div></div>`;
    }
    if (P())
      h += `<p class=center><button class=b data-action=review>${STR.review.open}</button></p>`;
    return h;
  }

  function viewRewards() {
    let h = `${ring()}<h3>${STR.rewards.title}</h3>`;
    for (const [n, r] of myRewards().entries()) {
      const ok = S.stars >= r.stars && S.balance >= r.points;
      h += `<div class=card${n ? '' : ' data-tour=rewards'}><div class=row><b>${named(r)}</b><span>${ok ? STR.rewards.unlocked : ''}</span></div><small>${r.stars} ${STR.star} ${r.points ? STR.rewards.pointsPlus(r.points) : ''}</small>${bar(S.stars, r.stars)}${r.points ? bar(S.balance, r.points) : ''}</div>`;
    }
    return h;
  }

  function viewHistory() {
    let h = `<h3>${STR.history.title}</h3>`;
    for (const [n, e] of S.hist.entries()) {
      h += `<div class=card${n ? '' : ' data-tour=hist'}><div class=row><div>${named(e)} ${
        e.kind === 'warn'
          ? STR.history.warning
          : e.kind === 'mark'
            ? STR.history.mark + esc(STR.history.markNames[e.note] || e.note)
            : ''
      }<br><small>${fmtTs(e.ts, { dateStyle: 'medium', timeStyle: 'short' })} ${
        e.note && notable(e) ? `· ${esc(e.note)}` : ''
      }</small></div><div>${e.kind === 'points' ? (e.points > 0 ? '+' : '') + e.points : ''} ${
        P() && notable(e)
          ? `<button class="b g" data-action=note data-id=${e.id}>${STR.noteLower}</button>`
          : ''
      } ${
        P() ? `<button class="b g" data-action=undo data-id=${e.id}>${STR.undoLower}</button>` : ''
      }</div></div></div>`;
    }
    return h;
  }

  // Emoji to pick from in the edit form, by what is edited (any other can be typed or pasted).
  const EMOJI = {
    item: [
      '⭐',
      '🌟',
      '💛',
      '😊',
      '🧹',
      '🧽',
      '🛏️',
      '🦷',
      '📚',
      '📖',
      '✏️',
      '🎹',
      '⚽',
      '🚴',
      '🍎',
      '🥦',
      '🐶',
      '🌅',
      '🧘',
      '💬',
    ],
    reward: [
      '🎁',
      '🏆',
      '🍦',
      '🍕',
      '🍝',
      '🎬',
      '🎮',
      '📕',
      '🌳',
      '🎡',
      '🧸',
      '🎨',
      '🏊',
      '🚲',
      '⛺',
      '🎟️',
    ],
    child: [
      '🦊',
      '🐻',
      '🐼',
      '🦁',
      '🐯',
      '🐰',
      '🦄',
      '🐸',
      '🐙',
      '🦖',
      '🐱',
      '🐶',
      '🚀',
      '🌈',
      '⚽',
      '🌸',
    ],
  };
  const emojiField = (list) => {
    const st = STR.settings;
    const cur = ed.emoji || '';
    return `<div class=emoji-field><p class=p0><label for=f_emoji>${st.fieldEmoji}</label><br><input id=f_emoji class=emoji-input maxlength=16 autocomplete=off value="${esc(cur)}"></p><div class=emoji-pick>${list
      .map(
        (e) =>
          `<button type=button class="emj${e === cur ? ' on' : ''}" data-action=pick-emoji data-e="${e}" aria-label="${e}">${e}</button>`,
      )
      .join(
        '',
      )}<button type=button class="emj${cur ? '' : ' on'}" data-action=pick-emoji data-e="" aria-label="${st.noEmoji}">∅</button></div></div>`;
  };

  // The edit form for an item or reward.
  function viewEdit() {
    const st = STR.settings;
    const r = ed.t === 'r';
    const k = ed.kind;
    if (ed.t === 'c')
      return `<div class=card><h3 class=edit-title>${(ed.id ? st.editTitle : st.addTitle).child}</h3><p><label for=f_name>${st.fieldName}</label><br><input id=f_name maxlength=40 value="${esc(ed.name)}"></p>${emojiField(EMOJI.child)}<button class=b data-action=save-ed>${st.save}</button> <button class="b g" data-action=cancel-ed>${st.cancel}</button></div>`;
    const num = (id, label, v) =>
      `<p><label for=${id}>${label}</label><br><input id=${id} type=number inputmode=numeric value="${v}"></p>`;
    let fields = '';
    if (r) {
      fields = num('f_stars', st.fieldStars, ed.stars) + num('f_points', st.fieldPoints, ed.points);
    } else if (k !== 'challenge') {
      fields = `<p><label for=f_note>${st.fieldNote}</label><br><input id=f_note value="${esc(ed.note)}"></p>${num(
        'f_min',
        k === 'penalty' ? st.fieldPenalty : st.fieldMin,
        ed.pmin,
      )}${k === 'target' ? num('f_max', st.fieldMax, ed.pmax) : ''}`;
    }
    // With several children: who it is for (all ticked = everyone, now and for children added later).
    if (S.children.length > 1) {
      fields += `<fieldset class=radios><legend>${st.forWho}</legend>${S.children
        .map(
          (c) =>
            `<label class=chk><input type=checkbox name=f_for value=${c.id}${ed.for == null || ed.for.includes(c.id) ? ' checked' : ''}> ${esc(c.name)}</label>`,
        )
        .join('')}<small>${st.forHelp}</small></fieldset>`;
    }
    return `<div class=card><h3 class=edit-title>${(ed.id ? st.editTitle : st.addTitle)[r ? 'reward' : k]}</h3><p><label for=f_name>${st.fieldName}</label><br><input id=f_name value="${esc(ed.name)}"></p>${emojiField(r ? EMOJI.reward : EMOJI.item)}${fields}<button class=b data-action=save-ed>${st.save}</button> <button class="b g" data-action=cancel-ed>${st.cancel}</button></div>`;
  }

  // ---- Evening reminder (Web Push), per device ----

  const pushOK = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  function viewReminder() {
    const R = STR.reminder;
    let h = `<small class=hint>${R.help}</small>`;
    if (!pushOK()) return `${h}<p><small>${R.unsupported}</small></p>`;
    if (Notification.permission === 'denied') h += `<p class=err>${R.denied}</p>`;
    const time = S.push.time || '19:30';
    h += `<div class=card><p class=p0><label for=rem_time>${R.time}</label><br><input id=rem_time type=time value="${time}"></p>`;
    h += S.push.time
      ? `<p class=p8>${R.on(S.push.time)}</p><button class=b data-action=rem-on>${R.save}</button> <button class="b g" data-action=rem-off>${R.off}</button>`
      : `<button class=b data-action=rem-on>${R.turnOn}</button>`;
    return `${h}</div>`;
  }

  // The server's public key (base64url) as the bytes PushManager wants.
  const keyBytes = (b64) => {
    const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };

  // Turn the reminder on (or change its time) for this device.
  async function reminderOn() {
    const time = $('rem_time')?.value || '19:30';
    try {
      if ((await Notification.requestPermission()) !== 'granted') return toast(STR.reminder.denied);
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(S.push.key),
        }));
      const j = sub.toJSON();
      if (await api('push/subscribe', { endpoint: j.endpoint, keys: j.keys, time }))
        toast(STR.reminder.on(time));
    } catch {
      toast(STR.reminder.failed);
    }
  }

  // A child's device: turn on notices (a parent allowed them), the same way as the reminder.
  async function childNoticesOn() {
    try {
      if ((await Notification.requestPermission()) !== 'granted') return render();
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(S.notices.key),
        }));
      const j = sub.toJSON();
      await api('push/child-subscribe', { endpoint: j.endpoint, keys: j.keys });
    } catch {
      toast(STR.reminder.failed);
    }
  }

  async function reminderOff() {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
    } catch {}
    api('push/unsubscribe', {});
  }

  // Owner only: export and delete, at the bottom of the Family section.
  function ownerTools() {
    const st = STR.settings;
    const ok = delTxt.trim() === S.family.name;
    return `<p class=p0><a class="b lnk" href=/api/export download>${st.exportData}</a></p><div class="card danger"><h3 class=edit-title>${st.deleteTitle}</h3><p><small>${st.deleteWarning}</small></p><p><label for=del_name>${st.deleteType}</label><br><input id=del_name autocomplete=off autocapitalize=off spellcheck=false value="${esc(delTxt)}"></p><button class="b r" id=del_btn data-action=del-family ${ok ? '' : 'disabled'}>${st.deleteButton}</button></div>`;
  }

  function viewSettings() {
    if (ed) return viewEdit();
    const st = STR.settings;
    const fam = S.family;
    const demo = !!S.demo;
    let h = demo ? `<p class=note>${STR.demo.off}</p>` : '';
    h += fold(
      'fam',
      st.family,
      esc(fam.name),
      `<div class=card><p class=p0><label for=f_fam>${st.familyName}</label><br><input id=f_fam maxlength=60 value="${esc(fam.name)}"></p><p><label for=f_tz>${st.timeZone}</label><br><input id=f_tz maxlength=60 value="${esc(fam.timezone)}"></p>${weekRadios('f_week', st, fam.weekStart)}${langRadios('f_lang', st.language, fam.language || 'en')}<button class=b data-action=save-family>${st.save}</button></div>${S.me.owner && !demo ? ownerTools() : ''}${S.idleDays ? `<p class=hint><small>${st.idleNote(S.idleDays)}</small></p>` : ''}`,
    );
    let c = '';
    for (const k of S.children) {
      // Notices on this child's device (rewards, milestones), when the installation has push.
      const bell =
        S.push && !demo
          ? `<br><button class="b g bell" data-action=notify data-id=${k.id} data-on=${k.notify ? 0 : 1} aria-pressed=${k.notify ? 'true' : 'false'}>${k.notify ? STR.notices.on : STR.notices.off}</button>`
          : '';
      c += `<div class=card><div class="row stk"><div>${named(k)}${bell}</div><div><button class=b data-action=edit data-t=c data-id=${k.id}>${st.rename}</button>${S.children.length > 1 ? ` <button class="b r" data-action=del-child data-id=${k.id}>${st.remove}</button>` : ''}</div></div></div>`;
    }
    c += `<button class=b data-action=edit data-t=c data-id=0>${st.addChild}</button>`;
    h += fold('kids', st.children, S.children.length, c);

    let pr = '';
    for (const p of S.parents) {
      const owner = S.me.owner && !p.me && !demo;
      pr += `<div class=card><div class="row stk"><div>${esc(p.name)}${p.me ? ` · <b>${st.you}</b>` : ''}<br><small>${esc(p.label)} · ${p.role === 'owner' ? st.owner : st.parentRole}</small></div>${
        owner
          ? `<div><button class="b g" data-action=make-owner data-id=${p.id}>${st.makeOwner}</button> <button class="b r" data-action=rm-parent data-id=${p.id}>${st.removeParent}</button></div>`
          : ''
      }</div></div>`;
    }
    if (iss?.type === 'invite/create') pr += issuedBox(st.inviteTitle, st.inviteHelp, '');
    else
      pr += `<button class=b ${demo ? 'disabled' : 'data-action=invite'}>${st.inviteParent}</button>`;
    if (S.invites.length) {
      pr += `<h3>${st.openInvites}</h3>`;
      for (const i of S.invites) {
        pr += `<div class=card><div class="row stk"><div>${st.inviteSent(fmtTs(i.created, { dateStyle: 'medium' }))}<br><small>${st.inviteUntil(fmtTs(i.expires, { dateStyle: 'medium' }))}</small></div><div><button class="b g" data-action=cancel-invite data-id=${i.id}>${st.cancelInvite}</button></div></div></div>`;
      }
    }
    h += fold('par', st.parents, S.parents.length, pr);
    for (const [k, t] of [
      ['target', st.behaviors],
      ['penalty', st.penalties],
      ['challenge', st.challenges],
    ]) {
      const list = S.items.filter((i) => i.kind === k);
      let g = '';
      list.forEach((i, x) => {
        const sub = (k === 'challenge' ? '' : range(i)) + forLabel(i);
        g += `<div class=card><div class="row stk"><div>${named(i)}<br><small>${sub}</small></div><div>${mvb('item', i.id, x, list.length)}<button class=b data-action=edit data-t=i data-id=${i.id} data-kind=${k}>${st.edit}</button> <button class="b r" data-action=del-item data-id=${i.id}>${st.remove}</button></div></div></div>`;
      });
      g += `<button class=b data-action=edit data-t=i data-id=0 data-kind=${k}>${st.add}</button>`;
      h += fold(k, t, list.length, g);
    }
    let g = '';
    S.rewards.forEach((r, x, L) => {
      g += `<div class=card><div class="row stk"><div>${named(r)}<br><small>${r.stars} ${STR.star} ${r.points ? STR.rewards.pointsPlus(r.points) : ''}${forLabel(r)}</small></div><div>${mvb('reward', r.id, x, L.length)}<button class=b data-action=edit data-t=r data-id=${r.id}>${st.edit}</button> <button class="b r" data-action=del-rew data-id=${r.id}>${st.remove}</button></div></div></div>`;
    });
    g += `<button class=b data-action=edit data-t=r data-id=0>${st.add}</button>`;
    h += fold('rew', st.rewards, S.rewards.length, g);

    g = `<small class=hint>${st.devicesHelp}</small>`;
    const D = S.devices || [];
    for (const d of D) {
      g += `<div class=card><div class="row stk"><div>${esc(st.deviceLabel(d.who || '', d.device))}${
        d.me ? ` · <b>${st.thisDevice}</b>` : ''
      }<br><small>${d.kind === 'parent' ? st.parentDevice : st.childDevice} · ${st.lastUsed(ago(d.last_seen))} · ${st.loggedIn(
        fmtTs(d.created, { dateStyle: 'medium' }),
      )}</small></div>${demo ? '' : `<div><button class="b r" data-action=revoke data-id=${d.id} data-me=${d.me ? 1 : 0}>${st.logOut}</button></div>`}</div></div>`;
    }
    if (iss?.type === 'pairing/create') {
      const k = S.children.find((x) => x.id === iss.child) || {};
      g += issuedBox(st.pairTitle(esc(k.name || '')), st.pairHelp, iss.code);
    } else {
      for (const k of S.children)
        g += `<p class=p0${k === S.children[0] ? ' data-tour=device' : ''}><button class=b ${demo ? 'disabled' : `data-action=pair-dev data-id=${k.id}`}>${st.addDevice(esc(k.name))}</button></p>`;
    }
    h += fold('dev', st.devices, D.length, g);
    if (S.push && !demo) h += fold('rem', STR.reminder.title, S.push.time || '', viewReminder());
    if (S.operator)
      h += fold(
        'ops',
        STR.operator.title,
        '',
        `<small class=hint>${STR.operator.help}</small><div id=ops-body>${opsHtml()}</div><p class=p0><button class=b data-action=ops-refresh>${STR.operator.refresh}</button></p>`,
      );
    const out = demo
      ? `<button class="b g" data-action=demo-leave>${STR.demo.leave}</button>`
      : `<button class="b g" data-action=logout>${st.signOut}</button>`;
    return `${h}<p class=center><button class="b g" data-action=tour>${STR.tour.take}</button> ${out}</p>${legal()}`;
  }

  // Box showing a freshly issued link (and code); the pairing one counts down.
  function issuedBox(title, help, code, expires) {
    const st = STR.settings;
    const pair = iss.type === 'pairing/create';
    return `<div class="card center"><h3 class=edit-title>${title}</h3><p><small>${help}</small></p>${
      code ? `<p class=code>${esc(code)}</p>` : ''
    }<p><input class=link readonly value="${esc(iss.link)}"></p><p><button class=b data-action=copy>${st.copy}</button>${
      navigator.share ? ` <button class=b data-action=share>${st.share}</button>` : ''
    }</p><p><small id=cd>${pair ? '' : expires || st.inviteExpires}</small></p><button class="b g" data-action=done>${st.done}</button></div>`;
  }

  // Update the "Expires in m:ss" line once a second; stop at zero.
  function tickCountdown() {
    const el = $('cd');
    if (!el || iss?.type !== 'pairing/create') return;
    const left = Math.max(0, Math.round((Date.parse(iss.expires) - Date.now()) / 1000));
    const st = STR.settings;
    el.textContent = left
      ? st.expiresIn(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`)
      : st.expired;
  }

  // Apply the dynamic bar widths (HTML style attributes are blocked by the CSP).
  function applyWidths() {
    for (const el of $('app').querySelectorAll('[data-w]')) el.style.width = `${el.dataset.w}%`;
  }

  function render() {
    screen = 'app';
    const T = { ...STR.tabs };
    if (!P()) delete T.set;
    if (!P() && tab === 'set') tab = 'today';
    const chips =
      P() && S.children.length > 1
        ? `<div class=chips>${S.children
            .map(
              (c) =>
                `<button class="chip${c.id === S.childId ? ' on' : ''}" data-action=child data-id=${c.id}>${named(c)}</button>`,
            )
            .join('')}</div>`
        : '';
    const day = fmtDay(S.today, { weekday: 'short', month: 'short', day: 'numeric' });
    let h = `<header><b id=hdr>${STR.header(fmtNum(S.balance), fmtNum(S.stars))}</b>${esc(day)}${
      P()
        ? ''
        : `<div class=who>${emo(S.children.find((c) => c.id === S.childId))}${esc(S.childName)}</div>`
    }</header>${demoBar()}${tourOffer()}${chips}<main>`;
    if (tab === 'today') h += viewToday();
    if (tab === 'week') h += rev ? viewReview() : viewWeek();
    if (tab === 'rew') h += viewRewards();
    if (tab === 'hist') h += viewHistory();
    if (tab === 'set' && P()) h += viewSettings();
    $('app').innerHTML = `${h}</main><div class=tabs>${Object.keys(T)
      .map(
        (k) =>
          `<button class="${k === tab ? 'on' : ''}"${k === tab ? ' aria-current=page' : ''} data-action=tab data-tab=${k}><i aria-hidden=true>${T[k][0]}</i>${T[k][1]}</button>`,
      )
      .join('')}</div>`;
    applyWidths();
    tickCountdown();
    celebrate();
    countUp();
    drawTour();
  }

  // On every screen of a demo: what it is, the view switch, the tour and the way out.
  function demoBar() {
    if (!S.demo) return '';
    const D = STR.demo;
    const min = Math.max(1, Math.round(S.demo.idleSeconds / 60));
    const view = P() ? D.childView(esc(S.childName)) : D.parentView;
    return `<div class=demo-bar role=region aria-label="${D.bannerLabel}"><p>${D.banner(min)}</p><div class=btns><button class=b data-action=demo-view>${view}</button><button class=b data-action=tour>${STR.tour.take}</button><button class="b g" data-action=demo-leave>${D.leave}</button></div></div>`;
  }

  // The once-only tour offer (never in a demo: its banner offers the tour every time).
  function tourOffer() {
    if (S.demo || tour || offerAnswered()) return '';
    const T = STR.tour;
    return `<div class=tour-offer role=region aria-label="${T.offerLabel}"><p>${T.offer}</p><div class=btns><button class=b data-action=tour>${T.take}</button><button class="b g" data-action=tour-no>${T.noThanks}</button></div></div>`;
  }

  // ---- Wiring ----

  $('app').addEventListener('click', onClick);
  $('toast').addEventListener('click', onClick);
  $('tour').addEventListener('click', onClick);
  // Escape closes the video player, else the tour.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('player')) closeVideo();
    else if (tour) closeTour();
  });
  window.addEventListener('resize', () => {
    if (tour) placeRing();
  });
  // The party overlay closes when its card is clicked.
  $('party').addEventListener('click', (e) => {
    if (e.target.closest('#party > div')) $('party').style.display = 'none';
  });
  // `toggle` does not bubble, so listen in the capture phase to remember open sections.
  $('app').addEventListener(
    'toggle',
    (e) => {
      if (!e.target.matches('details.fold')) return;
      op[e.target.dataset.key] = e.target.open;
      if (e.target.dataset.key === 'ops' && e.target.open) loadOps();
    },
    true,
  );
  // A language picked during setup applies to the page at once.
  $('app').addEventListener('change', (e) => {
    if (e.target.name === 's_lang') setupLang(e.target.value);
  });
  // Enable the Delete button only while the typed text is the family name.
  $('app').addEventListener('input', (e) => {
    if (e.target.id !== 'del_name') return;
    delTxt = e.target.value;
    $('del_btn').disabled = delTxt.trim() !== S.family.name;
  });

  async function boot() {
    await useLang(browserLang());
    try {
      cfg = await (await fetch('/api/config')).json();
    } catch {}
    if (!(await handleHash())) api('state');
  }

  // A pairing, invite or family invite link (#pair=… / #invite=… / #signup=…): on load, or
  // opened while the app is open.
  async function handleHash() {
    const m = location.hash.match(/^#(pair|invite|signup)=([\w-]+)$/);
    if (!m) return false;
    history.replaceState(null, '', location.pathname + location.search);
    if (m[1] === 'invite') showInvite(m[2]);
    else if (m[1] === 'signup') showSignup(m[2]);
    else await redeem(m[2]);
    return true;
  }

  window.addEventListener('hashchange', () => {
    handleHash();
  });

  boot();
  setInterval(tickCountdown, 1000);

  // Poll every 5 s while the page is visible, unless the user is editing or typing.
  setInterval(() => {
    if (
      screen === 'app' &&
      S &&
      document.visibilityState === 'visible' &&
      !ed &&
      !document.activeElement.matches('input, select')
    ) {
      const key = wq();
      const g = gen;
      const headers = etag && etagKey === key ? { 'If-None-Match': etag } : {};
      fetch(`/api/state${key}`, { headers })
        .then(async (r) => {
          // A demo that ended: say so. 304: nothing changed. Any other failure (429, 5xx,
          // signed out): skip silently.
          if (r.status === 401 && S?.demo) return api('state');
          if (r.status === 304 || !r.ok) return;
          const j = await r.json();
          if (screen === 'app' && g === gen && key === wq()) {
            S = j;
            etag = r.headers.get('ETag');
            etagKey = key;
            await useLang(wantedLang()); // another parent may have changed it
            if (S === j) render();
          }
        })
        .catch(() => {});
    }
  }, 5000);
})();
