// Little Wins front end. No inline script, style or handlers: the page is served under a strict
// Content Security Policy. Markup is generated as strings; clicks are handled by delegation on
// elements carrying data-action, and dynamic widths are applied after rendering.
(() => {
  const STR = window.STRINGS;

  let S = null; // last state received from the server
  let tab = 'today'; // selected tab
  let wkSel = null; // week start being viewed, or null for the current week
  let ed = null; // item or reward being edited, or null
  const op = {}; // which settings sections are open, remembered across renders
  let chSel = null; // child id being viewed by a parent, or null for the first child
  let cfg = { appName: STR.appName, providers: [] }; // public config, for the signed-out screen
  let screen = 'out'; // 'app' while the signed-in state is shown
  let iss = null; // device code or invite link just issued, shown until Done
  let cdTimer; // countdown of the device code
  try {
    chSel = +localStorage.getItem('child') || null;
  } catch {}

  const $ = (id) => document.getElementById(id);
  const P = () => S.role === 'parent';

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
    if (chSel && S?.role === 'parent') q.push(`child=${chSel}`);
    return q.length ? `?${q.join('&')}` : '';
  };

  const post = (path, body) =>
    fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });

  // ---- API ----

  // Take a state reply: remember the selection it shows and redraw.
  function take(j) {
    S = j;
    if (S.setup) return renderSetup();
    wkSel = S.week.current ? null : S.week.start;
    if (P()) {
      chSel = S.childId;
      try {
        localStorage.setItem('child', String(chSel));
      } catch {}
    }
    render();
  }

  // Call the API; on success store the new state and redraw. Returns true on success.
  async function api(path, body) {
    const r = await fetch(`/api/${path}${wq()}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    if (!r) {
      alert(STR.login.networkError);
      return false;
    }
    if (r.status === 401) {
      S = null;
      login();
      return false;
    }
    const j = await r.json().catch(() => ({}));
    if (j.error || !r.ok) {
      alert(j.error || STR.login.networkError);
      return false;
    }
    iss = j.issued ? { ...j.issued, type: path, child: body?.child_id } : iss;
    take(j);
    return true;
  }

  function goWeek(w) {
    wkSel = w;
    api('state');
  }

  // ---- Signed-out screens ----

  // The signed-out screen. With an invite token it is the "Join <family>" screen instead.
  function login(invite) {
    screen = 'out';
    clearInterval(cdTimer);
    const L = STR.login;
    const q = invite ? `?invite=${encodeURIComponent(invite.token)}` : '';
    const btns = cfg.providers
      .map(
        (p) =>
          `<p><a class="b lnk" href="/auth/${esc(p)}/login${q}">${esc(L.signInWith[p] || p)}</a></p>`,
      )
      .join('');
    let h = `<main class=center><h2>${esc(cfg.appName)}</h2>`;
    if (invite) {
      h += invite.family
        ? `<h3>${L.joinTitle(esc(invite.family))}</h3><p><small>${L.joinHelp}</small></p>${btns}<p><button class="b g" data-action=not-now>${L.notNow}</button></p>`
        : `<p class=err>${L.inviteInvalid}</p><p><button class="b g" data-action=not-now>${L.notNow}</button></p>`;
    } else {
      h += `<div class=card><h3 class=edit-title>${L.parentsOnly}</h3>${btns}</div><div class=card><h3 class=edit-title>${L.codeTitle}</h3><p><small>${L.codeHelp}</small></p><p><input id=code aria-label="${L.codeTitle}" autocapitalize=characters autocomplete=off autocorrect=off spellcheck=false placeholder="${L.codePlaceholder}"></p><p class=err id=err></p><p><button class=b data-action=pair-code>${L.codeButton}</button></p></div>`;
    }
    $('app').innerHTML = `${h}</main>`;
  }

  // Redeem a pairing code; on success load the child's state.
  async function redeem(code) {
    const r = await post('pair', { code }).catch(() => null);
    if (r?.ok) return api('state');
    const j = r ? await r.json().catch(() => ({})) : {};
    const msg = j.error || STR.login.codeFailed;
    if ($('err')) $('err').textContent = msg;
    else alert(msg);
    return false;
  }

  async function showInvite(token) {
    const r = await post('invite/info', { token }).catch(() => null);
    const j = r?.ok ? await r.json().catch(() => ({})) : {};
    login({ token, family: j.familyName || '' });
  }

  async function logout() {
    await post('logout').catch(() => {});
    S = null;
    iss = null;
    login();
  }

  // ---- Setup ----

  function renderSetup() {
    screen = 'out';
    const st = STR.setup;
    let tz = '';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {}
    const f = (id, label, v, max) =>
      `<p><label for=${id}>${label}</label><br><input id=${id} maxlength=${max} value="${esc(v)}"></p>`;
    $('app').innerHTML =
      `<main><h2 class=center>${st.title}</h2><div class=card><p class=p0>${S.me?.name ? st.hello(esc(S.me.name)) : ''}</p>${f('s_family', st.familyName, '', 60)}${f('s_child', st.childName, '', 40)}${f('s_tz', st.timeZone, tz, 60)}<p><label for=s_week>${st.weekStart}</label><br><select id=s_week><option value=1>${st.monday}</option><option value=0>${st.sunday}</option></select></p><p><label class=chk><input id=s_starter type=checkbox checked> ${st.starter}</label></p><button class=b data-action=do-setup>${st.create}</button></div><p class=center><button class="b g" data-action=logout>${st.signOut}</button></p></main>`;
  }

  function doSetup() {
    api('setup', {
      family_name: $('s_family').value,
      child_name: $('s_child').value,
      timezone: $('s_tz').value,
      week_start: +$('s_week').value,
      starter: $('s_starter').checked,
    });
  }

  // ---- Toast and celebration ----

  let toastTimer;
  const hideToast = () => {
    $('toast').style.display = 'none';
  };

  function toast(m, id) {
    const t = $('toast');
    t.innerHTML =
      `<span>${esc(m)}</span>` +
      (id ? `<button class="b g" data-action=toast-undo data-id=${id}>${STR.undo}</button>` : '');
    t.style.display = 'flex';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }

  function party(name) {
    const p = $('party');
    p.innerHTML = `<div><span>🎉</span>${STR.party.unlocked}<br><b>${esc(name)}</b></div>`;
    p.style.display = 'flex';
    setTimeout(() => {
      p.style.display = 'none';
    }, 7000);
  }

  // Celebrate rewards unlocked since the last render on this device (remembered per role).
  function celebrate() {
    try {
      const ids = S.rewards
        .filter((r) => S.stars >= r.stars && S.balance >= r.points)
        .map((r) => r.id);
      const k = `seen_${S.role}_${S.childId}`;
      const seen = JSON.parse(localStorage.getItem(k) || 'null');
      localStorage.setItem(k, JSON.stringify(ids));
      if (!seen) return; // first visit: nothing is "new"
      const fresh = S.rewards.filter((r) => ids.includes(r.id) && !seen.includes(r.id));
      if (fresh.length) party(fresh[0].name);
    } catch {}
  }

  // ---- Actions ----

  const desc = (e) =>
    e.kind === 'points'
      ? `${(e.points > 0 ? '+' : '') + e.points} · ${e.name}`
      : e.kind === 'warn'
        ? STR.warningPrefix + e.name
        : `${e.name}: ${e.note}`;

  // Call the API, then toast the newest history entry with an Undo button.
  async function act(path, body) {
    if ((await api(path, body)) && S.hist[0]) toast(desc(S.hist[0]), S.hist[0].id);
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
    act('add', { child_id: S.childId, item_id: id, points: p });
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
    if (ed.t === 'c') {
      path = 'child/save';
      body = { id: ed.id || undefined, name: g('f_name') };
    } else if (r) {
      path = 'reward/save';
      body = { id: ed.id, name: g('f_name'), stars: g('f_stars'), points: g('f_points') };
    }
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
    'not-now': () => {
      history.replaceState(null, '', location.pathname);
      api('state');
    },
    'do-setup': () => doSetup(),
    logout: () => logout(),
    child: (d) => {
      chSel = +d.id;
      api('state');
    },
    'save-family': () =>
      api('family/save', {
        name: $('f_fam').value,
        timezone: $('f_tz').value,
        week_start: +$('f_week').value,
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
      iss = null;
      render();
    },
    tab: (d) => {
      tab = d.tab;
      render();
    },
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
    const r = S.rewards.find((x) => !(S.stars >= x.stars && S.balance >= x.points));
    if (!r) return `<div class="card center">${STR.ring.allUnlocked}</div>`;
    const a = Math.min(1, S.stars / (r.stars || 1));
    const b = r.points ? Math.min(1, S.balance / r.points) : a;
    const pc = Math.round(100 * (r.stars && r.points ? (a + b) / 2 : r.points ? b : a));
    const C = 264;
    return `<div class="card ringcard"><svg width=96 height=96 viewBox="0 0 100 100"><circle cx=50 cy=50 r=42 fill=none stroke="#dde" stroke-width=10 /><circle cx=50 cy=50 r=42 fill=none stroke="#2a7f8e" stroke-width=10 stroke-linecap=round stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pc / 100)}" transform="rotate(-90 50 50)"/><text x=50 y=57 text-anchor=middle font-size=22 font-weight=700 fill="#1f3a5f">${pc}%</text></svg><div><small>${STR.ring.next}</small><br><b>${esc(r.name)}</b><br><small>${S.stars}/${r.stars} ${STR.star}${r.points ? ` · ${S.balance}/${r.points} ${STR.ring.pts}` : ''}</small></div></div>`;
  }

  function viewToday() {
    let h = '';
    if (!P()) h += ring();
    h += `<h3>${P() ? STR.today.earn : STR.today.waysToEarn}</h3>`;
    for (const i of S.items.filter((x) => x.kind === 'target')) {
      h += `<div class=card><div class=row><div>${esc(i.name)}<br><small>${i.note ? `${esc(i.note)} · ` : ''}${range(i)}</small></div>${
        P()
          ? `<div><button class=b data-action=add data-id=${i.id}>+</button> <button class="b w" data-action=warn data-id=${i.id}>${STR.today.warnButton(S.warn[i.id] || 0)}</button></div>`
          : ''
      }</div></div>`;
    }
    if (P()) {
      h += `<h3>${STR.today.penalties}</h3>`;
      for (const i of S.items.filter((x) => x.kind === 'penalty')) {
        h += `<div class=card><div class=row><div>${esc(i.name)}<br><small>${esc(i.note)}</small></div><button class="b r" data-action=pen data-id=${i.id}>-${i.pmin}</button></div></div>`;
      }
    }
    return h;
  }

  function viewWeek() {
    const W = S.week;
    const fd = (d) =>
      new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const nw = Object.keys(S.won).length;
    const wk = STR.week;
    let h = `<div class="card wnav"><button class="b g" ${W.prev ? `data-action=week data-week="${W.prev}"` : 'disabled'} aria-label="${wk.prevLabel}">‹</button><div><b>${W.current ? wk.thisWeek : wk.weekOf(fd(W.days[0]))}</b><br><small>${fd(W.days[0])} – ${fd(W.days[6])}${nw ? wk.starsWon(nw) : ''}</small></div><button class="b g" ${W.next ? `data-action=week data-week="${W.next}"` : 'disabled'} aria-label="${wk.nextLabel}">›</button></div>`;
    if (!W.current)
      h += `<p class=back><button class="b g" data-action=week data-week="">${wk.back}</button></p>`;
    h += `<h3>${wk.challenges}</h3><small class=hint>${wk.rule}${P() ? wk.ruleParent : ''}</small>`;
    for (const i of S.items.filter((x) => x.kind === 'challenge')) {
      const m = W.marks[i.id] || [];
      const pf = m.filter((x) => x === 'perfect').length;
      const bd = m.includes('bad');
      const days = W.days
        .map((d, k) => {
          const v = m[k];
          const fut = d > S.today;
          const sym = wk.marks[v] || wk.marks.none;
          const label = `${W.lbl[k]} ${+d.slice(8)}<br>${sym}`;
          return P() && !fut
            ? `<button class="d ${v || ''}" data-action=cyc data-id=${i.id} data-k=${k}>${label}</button>`
            : `<span class="d ${v || ''}${fut ? ' fut' : ''}">${label}</span>`;
        })
        .join('');
      h += `<div class=card><div class=row><div>${esc(i.name)}<br><small>${
        S.won[i.id] ? '' : wk.perfectDays(pf) + (bd ? wk.aBadDay : '')
      }</small></div>${S.won[i.id] ? `<b>${wk.won}</b>` : ''}</div><div class=strip>${days}</div></div>`;
    }
    return h;
  }

  function viewRewards() {
    let h = `${ring()}<h3>${STR.rewards.title}</h3>`;
    for (const r of S.rewards) {
      const ok = S.stars >= r.stars && S.balance >= r.points;
      h += `<div class=card><div class=row><b>${esc(r.name)}</b><span>${ok ? STR.rewards.unlocked : ''}</span></div><small>${r.stars} ${STR.star} ${r.points ? STR.rewards.pointsPlus(r.points) : ''}</small>${bar(S.stars, r.stars)}${r.points ? bar(S.balance, r.points) : ''}</div>`;
    }
    return h;
  }

  function viewHistory() {
    let h = `<h3>${STR.history.title}</h3>`;
    for (const e of S.hist) {
      h += `<div class=card><div class=row><div>${esc(e.name)} ${
        e.kind === 'warn'
          ? STR.history.warning
          : e.kind === 'mark'
            ? STR.history.mark + esc(e.note)
            : ''
      }<br><small>${new Date(e.ts).toLocaleString()} ${
        e.note && e.kind === 'points' ? `· ${esc(e.note)}` : ''
      }</small></div><div>${e.kind === 'points' ? (e.points > 0 ? '+' : '') + e.points : ''} ${
        P() ? `<button class="b g" data-action=undo data-id=${e.id}>${STR.undoLower}</button>` : ''
      }</div></div></div>`;
    }
    return h;
  }

  // The edit form for an item or reward.
  function viewEdit() {
    const st = STR.settings;
    const r = ed.t === 'r';
    const k = ed.kind;
    if (ed.t === 'c')
      return `<div class=card><h3 class=edit-title>${ed.id ? st.formEdit : st.formAdd} ${st.child}</h3><p><label for=f_name>${st.fieldName}</label><br><input id=f_name maxlength=40 value="${esc(ed.name)}"></p><button class=b data-action=save-ed>${st.save}</button> <button class="b g" data-action=cancel-ed>${st.cancel}</button></div>`;
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
    return `<div class=card><h3 class=edit-title>${ed.id ? st.formEdit : st.formAdd} ${r ? st.reward : k}</h3><p><label for=f_name>${st.fieldName}</label><br><input id=f_name value="${esc(ed.name)}"></p>${fields}<button class=b data-action=save-ed>${st.save}</button> <button class="b g" data-action=cancel-ed>${st.cancel}</button></div>`;
  }

  function viewSettings() {
    if (ed) return viewEdit();
    const st = STR.settings;
    const fam = S.family;
    let h = fold(
      'fam',
      st.family,
      esc(fam.name),
      `<div class=card><p class=p0><label for=f_fam>${st.familyName}</label><br><input id=f_fam maxlength=60 value="${esc(fam.name)}"></p><p><label for=f_tz>${st.timeZone}</label><br><input id=f_tz maxlength=60 value="${esc(fam.timezone)}"></p><p><label for=f_week>${st.weekStart}</label><br><select id=f_week><option value=1 ${fam.weekStart ? 'selected' : ''}>${st.monday}</option><option value=0 ${fam.weekStart ? '' : 'selected'}>${st.sunday}</option></select></p><button class=b data-action=save-family>${st.save}</button></div>`,
    );
    let c = '';
    for (const k of S.children) {
      c += `<div class=card><div class="row stk"><div>${esc(k.name)}</div><div><button class=b data-action=edit data-t=c data-id=${k.id}>${st.rename}</button>${S.children.length > 1 ? ` <button class="b r" data-action=del-child data-id=${k.id}>${st.remove}</button>` : ''}</div></div></div>`;
    }
    c += `<button class=b data-action=edit data-t=c data-id=0>${st.addChild}</button>`;
    h += fold('kids', st.children, S.children.length, c);

    let pr = '';
    for (const p of S.parents) {
      const owner = S.me.owner && !p.me;
      pr += `<div class=card><div class="row stk"><div>${esc(p.name)}${p.me ? ` · <b>${st.you}</b>` : ''}<br><small>${esc(p.label)} · ${p.role === 'owner' ? st.owner : st.parentRole}</small></div>${
        owner
          ? `<div><button class="b g" data-action=make-owner data-id=${p.id}>${st.makeOwner}</button> <button class="b r" data-action=rm-parent data-id=${p.id}>${st.removeParent}</button></div>`
          : ''
      }</div></div>`;
    }
    if (iss?.type === 'invite/create') pr += issuedBox(st.inviteTitle, st.inviteHelp, '');
    else pr += `<button class=b data-action=invite>${st.inviteParent}</button>`;
    if (S.invites.length) {
      pr += `<h3>${st.openInvites}</h3>`;
      for (const i of S.invites) {
        pr += `<div class=card><div class="row stk"><div>${st.inviteSent(new Date(i.created).toLocaleDateString())}<br><small>${st.inviteUntil(new Date(i.expires).toLocaleDateString())}</small></div><div><button class="b g" data-action=cancel-invite data-id=${i.id}>${st.cancelInvite}</button></div></div></div>`;
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
        const sub = k === 'challenge' ? '' : range(i);
        g += `<div class=card><div class="row stk"><div>${esc(i.name)}<br><small>${sub}</small></div><div>${mvb('item', i.id, x, list.length)}<button class=b data-action=edit data-t=i data-id=${i.id} data-kind=${k}>${st.edit}</button> <button class="b r" data-action=del-item data-id=${i.id}>${st.remove}</button></div></div></div>`;
      });
      g += `<button class=b data-action=edit data-t=i data-id=0 data-kind=${k}>${st.add}</button>`;
      h += fold(k, t, list.length, g);
    }
    let g = '';
    S.rewards.forEach((r, x, L) => {
      g += `<div class=card><div class="row stk"><div>${esc(r.name)}<br><small>${r.stars} ${STR.star} ${r.points ? STR.rewards.pointsPlus(r.points) : ''}</small></div><div>${mvb('reward', r.id, x, L.length)}<button class=b data-action=edit data-t=r data-id=${r.id}>${st.edit}</button> <button class="b r" data-action=del-rew data-id=${r.id}>${st.remove}</button></div></div></div>`;
    });
    g += `<button class=b data-action=edit data-t=r data-id=0>${st.add}</button>`;
    h += fold('rew', st.rewards, S.rewards.length, g);

    g = `<small class=hint>${st.devicesHelp}</small>`;
    const D = S.devices || [];
    for (const d of D) {
      g += `<div class=card><div class="row stk"><div>${esc(st.deviceLabel(d.who || '', d.device))}${
        d.me ? ` · <b>${st.thisDevice}</b>` : ''
      }<br><small>${d.kind === 'parent' ? st.parentDevice : st.childDevice} · ${st.lastUsed(ago(d.last_seen))} · ${st.loggedIn(
        new Date(d.created).toLocaleDateString(),
      )}</small></div><div><button class="b r" data-action=revoke data-id=${d.id} data-me=${d.me ? 1 : 0}>${st.logOut}</button></div></div></div>`;
    }
    if (iss?.type === 'pairing/create') {
      const k = S.children.find((x) => x.id === iss.child) || {};
      g += issuedBox(st.pairTitle(esc(k.name || '')), st.pairHelp, iss.code);
    } else {
      for (const k of S.children)
        g += `<p class=p0><button class=b data-action=pair-dev data-id=${k.id}>${st.addDevice(esc(k.name))}</button></p>`;
    }
    h += fold('dev', st.devices, D.length, g);
    return `${h}<p class=center><button class="b g" data-action=logout>${st.signOut}</button></p>`;
  }

  // Box showing a freshly issued link (and code); the pairing one counts down.
  function issuedBox(title, help, code) {
    const st = STR.settings;
    const pair = iss.type === 'pairing/create';
    return `<div class="card center"><h3 class=edit-title>${title}</h3><p><small>${help}</small></p>${
      code ? `<p class=code>${esc(code)}</p>` : ''
    }<p><input class=link readonly value="${esc(iss.link)}"></p><p><button class=b data-action=copy>${st.copy}</button>${
      navigator.share ? ` <button class=b data-action=share>${st.share}</button>` : ''
    }</p><p><small id=cd>${pair ? '' : st.inviteExpires}</small></p><button class="b g" data-action=done>${st.done}</button></div>`;
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
                `<button class="chip${c.id === S.childId ? ' on' : ''}" data-action=child data-id=${c.id}>${esc(c.name)}</button>`,
            )
            .join('')}</div>`
        : '';
    let h = `<header><b>${STR.header(S.balance, S.stars)}</b>${S.today}${
      P() ? '' : `<div class=who>${esc(S.childName)}</div>`
    }</header>${chips}<main>`;
    if (tab === 'today') h += viewToday();
    if (tab === 'week') h += viewWeek();
    if (tab === 'rew') h += viewRewards();
    if (tab === 'hist') h += viewHistory();
    if (tab === 'set' && P()) h += viewSettings();
    $('app').innerHTML = `${h}</main><div class=tabs>${Object.keys(T)
      .map(
        (k) =>
          `<button class="${k === tab ? 'on' : ''}" data-action=tab data-tab=${k}><i aria-hidden=true>${T[k][0]}</i>${T[k][1]}</button>`,
      )
      .join('')}</div>`;
    applyWidths();
    tickCountdown();
    celebrate();
  }

  // ---- Wiring ----

  $('app').addEventListener('click', onClick);
  $('toast').addEventListener('click', onClick);
  // The party overlay closes when its card is clicked.
  $('party').addEventListener('click', (e) => {
    if (e.target.closest('#party > div')) $('party').style.display = 'none';
  });
  // `toggle` does not bubble, so listen in the capture phase to remember open sections.
  $('app').addEventListener(
    'toggle',
    (e) => {
      if (e.target.matches('details.fold')) op[e.target.dataset.key] = e.target.open;
    },
    true,
  );

  async function boot() {
    try {
      cfg = await (await fetch('/api/config')).json();
    } catch {}
    if (!(await handleHash())) api('state');
  }

  // A pairing or invite link (#pair=… / #invite=…): on load, or opened while the app is open.
  async function handleHash() {
    const m = location.hash.match(/^#(pair|invite)=([\w-]+)$/);
    if (!m) return false;
    history.replaceState(null, '', location.pathname + location.search);
    if (m[1] === 'invite') showInvite(m[2]);
    else if (!(await redeem(m[2]))) login();
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
      const w = wkSel;
      const c = chSel;
      fetch(`/api/state${wq()}`)
        .then((r) => (r.ok ? r.json() : 0))
        .then((j) => {
          if (j && screen === 'app' && w === wkSel && c === chSel) {
            S = j;
            render();
          }
        })
        .catch(() => {});
    }
  }, 5000);
})();
