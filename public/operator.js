// The operator dashboard: counts and health, and the settings the operator may change here
// (they win over .env until reset). English only. Everything is built with the DOM, so no value
// from the server is ever read as HTML, and the strict Content Security Policy holds.
(() => {
  const app = document.getElementById('app');
  let D = null; // the last dashboard reply
  const errors = {}; // setting key -> the server's refusal

  /** h('p', { class: 'x' }, 'text', child…): an element. */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) el.append(kid);
    return el;
  }
  const svg = (tag, attrs, ...kids) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (const kid of kids) el.append(kid);
    return el;
  };
  const num = (n) => Number(n).toLocaleString('en');
  const bytes = (n) =>
    n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
  const since = (s) => {
    const d = Math.floor(s / 86400);
    const hr = Math.floor((s % 86400) / 3600);
    return d ? `${d} d ${hr} h` : `${hr} h ${Math.floor((s % 3600) / 60)} min`;
  };
  const day = (iso) =>
    new Date(iso).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });

  async function call(path, body) {
    const r = await fetch(`/api/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    return { status: r ? r.status : 0, json: j };
  }

  async function load() {
    const r = await call('operator/dashboard');
    if (r.status === 200) {
      D = r.json;
      return render();
    }
    app.replaceChildren(
      h(
        'p',
        { class: 'note' },
        r.status === 401
          ? [
              'Sign in to Little Wins first, with an account on OPERATOR_ALLOWLIST. ',
              h('a', { href: '/' }, 'Sign in'),
            ]
          : r.status === 403
            ? "This account isn't an operator of this Little Wins (OPERATOR_ALLOWLIST)."
            : "The dashboard didn't load. Try again in a moment.",
      ),
    );
  }

  function stat(value, label) {
    return h('div', { class: 'stat' }, h('b', {}, value), h('small', {}, label));
  }

  function stats() {
    const s = D.stats;
    const cap = D.familyLimit ? ` of ${num(D.familyLimit)}` : '';
    const cards = [
      stat(`${num(s.families)}${cap}`, D.familyLimit ? 'families (the cap)' : 'families'),
      stat(num(s.newFamilies30d), 'new families, last 30 days'),
      stat(
        num(s.activeFamilies7d),
        `families active this week (${num(s.activeFamilies30d)} this month)`,
      ),
      stat(num(s.parents), 'parents'),
      stat(num(s.children), 'children'),
      stat(
        num(s.devices),
        `devices (${num(s.parentDevices)} parents', ${num(s.childDevices)} children's)`,
      ),
      stat(
        num(s.activeDevices1d),
        `devices used today (${num(s.activeDevices7d)} this week, ${num(s.activeDevices30d)} this month)`,
      ),
      stat(num(s.entries7d), `entries this week (${num(s.entries)} in all)`),
      stat(num(s.reminders), "parents' evening reminders"),
      stat(num(s.childNotices), "children's devices with notices"),
      stat(num(s.openFamilyInvites), 'open family invites'),
      stat(num(D.demoFamilies), D.demoOn ? 'demo families right now' : 'demo families (off)'),
    ];
    if (s.unclaimedFamilies)
      cards.push(stat(num(s.unclaimedFamilies), 'families without a parent'));
    if (D.idleFamilyDays)
      cards.push(stat(num(s.idleSoon), 'families deleted as idle within 30 days, unless used'));
    return cards;
  }

  /** New families per week, as bars (12 weeks, oldest first). */
  function chart() {
    const weeks = D.stats.weeks;
    const max = Math.max(1, ...weeks.map((w) => w.families));
    const W = 600;
    const H = 150;
    const bw = W / weeks.length;
    const g = svg('svg', {
      class: 'chart',
      viewBox: `0 0 ${W} ${H + 18}`,
      role: 'img',
      'aria-label': `New families per week: ${weeks.map((w) => w.families).join(', ')}`,
    });
    weeks.forEach((w, i) => {
      const bh = Math.round((w.families / max) * (H - 16));
      const x = i * bw + 6;
      g.append(svg('rect', { x, y: H - bh, width: bw - 12, height: Math.max(bh, 1), rx: 3 }));
      const v = svg('text', {
        x: x + (bw - 12) / 2,
        y: H - bh - 4,
        'text-anchor': 'middle',
        class: 'val',
      });
      v.textContent = String(w.families);
      g.append(v);
      const t = svg('text', { x: x + (bw - 12) / 2, y: H + 14, 'text-anchor': 'middle' });
      t.textContent = new Date(`${w.from}T12:00:00Z`).toLocaleDateString('en', {
        month: 'short',
        day: 'numeric',
      });
      g.append(t);
    });
    return g;
  }

  function languages() {
    const rows = D.stats.languages;
    if (!rows.length) return h('p', { class: 'muted' }, 'No families yet.');
    return h(
      'table',
      {},
      h(
        'tbody',
        {},
        rows.map((r) => h('tr', {}, h('td', {}, r.language), h('td', {}, num(r.families)))),
      ),
    );
  }

  /** The control for one setting; `read()` gives its value as the string .env would hold. */
  function control(s, id) {
    // Choices are radio buttons: a <select> built by script trips WebKit's CSP check.
    if (s.type === 'choice' || s.type === 'bool') {
      const opts =
        s.type === 'bool'
          ? [
              ['1', 'On'],
              ['0', 'Off'],
            ]
          : s.choices.map((c) => [c, c]);
      const now = s.type === 'bool' ? (s.value === '0' ? '0' : '1') : s.value || 'closed';
      const radios = opts.map(([v]) =>
        h('input', { type: 'radio', name: id, value: v, checked: v === now }),
      );
      const el = h(
        'div',
        { class: 'checks', id, role: 'radiogroup', 'aria-label': s.label },
        opts.map(([, label], i) => h('label', {}, radios[i], ` ${label}`)),
      );
      return { el, read: () => radios.find((r) => r.checked)?.value ?? now };
    }
    if (s.type === 'events') {
      const now = s.value ? s.value.split(',').map((x) => x.trim()) : s.choices;
      const boxes = s.choices.map((c) =>
        h('input', { type: 'checkbox', value: c, checked: now.includes(c) }),
      );
      const el = h(
        'div',
        { class: 'checks', id, role: 'group', 'aria-label': s.label },
        s.choices.map((c, i) => h('label', {}, boxes[i], ` ${c}`)),
      );
      return {
        el,
        read: () =>
          boxes
            .filter((b) => b.checked)
            .map((b) => b.value)
            .join(','),
      };
    }
    const el = h('input', {
      id,
      type: s.type === 'number' ? 'number' : 'text',
      value: s.value,
      min: s.type === 'number' ? '0' : null,
      placeholder: s.modeDefault
        ? `${s.modeDefault} (default for this sign-up mode)`
        : s.type === 'number'
          ? ''
          : 'empty: none',
      autocomplete: 'off',
      spellcheck: 'false',
    });
    return { el, read: () => el.value.trim() };
  }

  function source(s) {
    if (s.source === 'dashboard')
      return h(
        'span',
        { class: 'src dashboard' },
        `Changed here, ${day(s.updated)}. .env: ${s.env === '' ? '(not set)' : s.env}`,
      );
    return h(
      'span',
      { class: 'src' },
      s.source === 'env' ? 'From .env' : 'Default (not set in .env)',
    );
  }

  function settingRow(s) {
    const id = `set-${s.key}`;
    const c = control(s, id);
    const save = h('button', { type: 'button', 'data-key': s.key }, 'Save');
    save.addEventListener('click', () => change(s.key, { value: c.read() }, save));
    const reset =
      s.source === 'dashboard' ? h('button', { type: 'button', class: 'g' }, 'Back to .env') : null;
    reset?.addEventListener('click', () => change(s.key, { reset: true }, reset));
    return h(
      'div',
      { class: 'setting', 'data-setting': s.key },
      h(
        'div',
        {},
        ['events', 'choice', 'bool'].includes(s.type)
          ? h('span', { class: 'name' }, s.label)
          : h('label', { for: id }, s.label),
        h('span', { class: 'help' }, `${s.key}. ${s.help}`),
      ),
      h(
        'div',
        {},
        c.el,
        source(s),
        errors[s.key] ? h('span', { class: 'err', role: 'alert' }, errors[s.key]) : null,
      ),
      h('div', { class: 'btns' }, save, reset),
    );
  }

  async function change(key, body, button) {
    button.disabled = true;
    const r = await call('operator/setting', { key, ...body });
    if (r.status === 200) {
      delete errors[key];
      D = r.json;
    } else {
      errors[key] = r.json.detail || r.json.error || "That didn't work.";
    }
    render();
    document.querySelector(`[data-setting="${key}"] button`)?.focus();
  }

  function render() {
    const groups = new Map();
    for (const s of D.settings) {
      if (!groups.has(s.group)) groups.set(s.group, []);
      groups.get(s.group).push(s);
    }
    app.replaceChildren(
      h(
        'p',
        { class: 'health' },
        `Version ${D.version} · Node ${D.node} · up ${since(D.uptimeSeconds)} · database ${bytes(D.stats.dbBytes)} · sign-up ${D.signupMode} · evening reminders ${D.remindersOn ? 'on' : 'off'} · operator emails ${D.emailsOn ? 'on' : 'off'} `,
        h('button', { type: 'button', class: 'g', onclick: load }, 'Refresh'),
      ),
      h('h2', {}, 'This Little Wins'),
      h('div', { class: 'cards' }, stats()),
      h(
        'div',
        { class: 'panels' },
        h('div', { class: 'panel' }, h('h3', {}, 'New families per week'), chart()),
        h('div', { class: 'panel' }, h('h3', {}, 'Families by language'), languages()),
      ),
      h('h2', {}, 'Settings'),
      h(
        'p',
        { class: 'muted' },
        'A change here applies at once and wins over .env, also after a restart, until you put it back to .env. Secrets, sign-in, addresses, OPERATOR_ALLOWLIST, the mail server and settings read only at startup stay in .env.',
      ),
      // (replaceChildren doesn't flatten arrays, so spread the fieldsets.)
      ...[...groups].map(([name, list]) =>
        h('fieldset', {}, h('legend', {}, name), list.map(settingRow)),
      ),
      h(
        'p',
        { class: 'muted' },
        'Counts only: this page never shows a family, a name or anything a family recorded.',
      ),
    );
  }

  load();
})();
