/* Windenergietage 2026 – Planer: Ansichten und Steuerung */
(function () {
  'use strict';
  const M = window.Model, S = window.Store, U = window.UI, CFG = window.CFG, P = window.PROGRAM;
  const { esc, $, $$, ic, icFill, toast } = U;
  const AXIS = 44;
  const PLAN_NAME = { A: 'Plan A', B: 'Plan B', M: 'Merkliste' };
  let mapCtl = null;
  const q = { text: '' };

  /* ---------- Hilfen ---------- */
  function berlinNow() {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const o = Object.fromEntries(f.formatToParts(new Date()).map(p => [p.type, p.value]));
    return { date: `${o.year}-${o.month}-${o.day}`, min: parseInt(o.hour, 10) * 60 + parseInt(o.minute, 10) };
  }
  function nowFor(day) { const n = berlinNow(); return M.dayInfo[day].date === n.date ? n.min : null; }
  const vShort = v => v.label.replace('Forum ', 'F').replace('Themenhaus ', 'H').replace('Thementisch ', 'T');
  const groupsSet = () => new Set(S.ui.groups || M.groups.map(g => g[0]));
  const venueLine = v => (v.room && v.room !== v.label ? `${v.label} · ${v.room}` : v.label);

  /* ---------- Grundgerüst ---------- */
  function renderTop() {
    const d = S.ui.day;
    $('#days').innerHTML = M.days.map(x => {
      const [, m, dd] = x.date.split('-');
      const n = Object.keys(S.fav).filter(id => M.byId[id].day === x.id).length;
      return `<button data-act="day" data-day="${x.id}" aria-pressed="${x.id === d}">${esc(x.name.slice(0, 2))} ${parseInt(dd, 10)}.${parseInt(m, 10)}.<small>${n ? n + ' ★' : '&nbsp;'}</small></button>`;
    }).join('');
    const tabs = [['prog', 'grid', 'Programm'], ['plan', 'plan', 'Mein Plan'], ['map', 'map', 'Karte'], ['info', 'info', 'Mehr']];
    let badge = '';
    const iss = totalIssues();
    if (iss > 0) badge = `<span class="badge">${iss}</span>`;
    else if (S.counts().A + S.counts().B > 0) badge = `<span class="badge ok">✓</span>`;
    $('#tabs').innerHTML = tabs.map(([k, i, l]) => `<button data-act="tab" data-tab="${k}" ${S.ui.tab === k ? 'aria-current="page"' : ''}>${ic(i)}${l}${k === 'plan' ? badge : ''}</button>`).join('');
  }
  function totalIssues() {
    let n = 0;
    for (const d of M.days) for (const p of ['A', 'B']) {
      const a = M.analyze(S.dayList(d.id, p), S.set.speed);
      n += [...a.conf.keys()].length ? Math.ceil(a.conf.size / 2) : 0;
    }
    return n;
  }

  function render(opt) {
    opt = opt || {};
    renderTop();
    const main = $('#main');
    if (mapCtl && S.ui.tab !== 'map') { mapCtl.destroy(); mapCtl = null; }
    const keep = opt.keep ? saveScroll() : null;
    if (S.ui.tab === 'prog') renderProg();
    else if (S.ui.tab === 'plan') renderPlan();
    else if (S.ui.tab === 'map') renderMap();
    else renderInfo();
    if (keep) restoreScroll(keep);
    S.save();
  }
  function saveScroll() { const e = $('.grid-scroll') || $('.scroll'); return e ? { k: e.className, x: e.scrollLeft, y: e.scrollTop } : null; }
  function restoreScroll(k) { const e = $('.grid-scroll') || $('.scroll'); if (e && k && e.className === k.k) { e.scrollLeft = k.x; e.scrollTop = k.y; } }

  /* ---------- Karten im Stundenplan ---------- */
  function cardHtml(s, o) {
    o = o || {};
    const v = M.venues[s.v], plan = S.get(s.id);
    const ppm = o.ppm, h = Math.max((s.e - s.s) * ppm - 1, 16);
    const lines = Math.max(1, Math.min(8, Math.floor((h - 15) / 14)));
    const cls = ['card', 'k-' + (v.kind === 'forum' && (v.group === 'Extras') ? 'extra' : v.kind)];
    if (s.pause) cls.push('pause');
    if (plan) cls.push('pl-' + plan);
    if (o.flags) cls.push(...o.flags);
    if (o.dim) cls.push('dim');
    if (o.spine) cls.push('spine');
    const left = `calc(var(--off,0px) + (100% - var(--off,0px)) * ${o.lane / o.n})`;
    const width = `calc((100% - var(--off,0px)) / ${o.n} - 2px)`;
    const style = `top:${(s.s - o.t0) * ppm}px;height:${h}px;left:${o.spine ? '1px' : left};${o.spine ? '' : 'width:' + width + ';'}--lines:${lines}`;
    const tag = plan ? `<span class="tag"><span class="pl ${plan}">${plan === 'M' ? '★' : plan}</span></span>` : '';
    const warn = o.flags && o.flags.includes('conflict') ? '<span class="warnico">⚠ </span>' : '';
    const tline = o.showVenue ? `${M.range(s)} · ${esc(vShort(v))}` : M.range(s);
    const sp = !o.spine && o.n === 1 && h >= 74 && s.sp ? `<span class="s">${esc(s.sp)}</span>` : '';
    const t = s.pause ? `<span class="n">${esc(s.t)}</span>` : `<span class="t">${tline}</span><span class="n">${warn}${esc(s.t)}</span>${sp}${tag}`;
    return `<${s.pause ? 'div' : 'button'} class="${cls.join(' ')}" style="${style}" ${s.pause ? '' : `data-act="card" data-id="${s.id}" aria-label="${esc(s.t)}, ${M.range(s)}, ${esc(venueLine(v))}"`}>${t}</${s.pause ? 'div' : 'button'}>`;
  }

  /* ---------- Programm ---------- */
  function renderProg() {
    const main = $('#main');
    const g = groupsSet();
    main.innerHTML = `
      <div class="toolbar">
        <label class="search">${ic('search')}<input id="q" type="search" placeholder="Titel, Referent, Firma, Forum…" value="${esc(q.text)}" autocomplete="off" enterkeyhint="search"></label>
        <button class="iconbtn" data-act="view" data-view="grid" aria-pressed="${S.ui.view === 'grid'}" aria-label="Stundenplan">${ic('cols')}</button>
        <button class="iconbtn" data-act="view" data-view="list" aria-pressed="${S.ui.view === 'list'}" aria-label="Liste">${ic('list')}</button>
        ${S.ui.view === 'grid' ? `<button class="iconbtn" data-act="zoom" data-d="-0.4" aria-label="Zeitraster verkleinern">${ic('minus')}</button><button class="iconbtn" data-act="zoom" data-d="0.4" aria-label="Zeitraster vergrößern">${ic('plus')}</button>` : ''}
        ${nowFor(S.ui.day) != null ? `<button class="iconbtn" data-act="now" aria-label="Zur aktuellen Uhrzeit">${ic('clock')}</button>` : ''}
      </div>
      <div class="chips">${M.groups.map(([k, l]) => `<button class="chip" data-act="grp" data-g="${k}" aria-pressed="${g.has(k)}">${esc(l)}</button>`).join('')}</div>
      <div id="pcontent" style="display:flex;flex-direction:column;flex:1;min-height:0"></div>`;
    fillProg();
  }
  function fillProg(keep) {
    const el = $('#pcontent');
    if (!el) return;
    const k = keep ? saveScroll() : null;
    el.innerHTML = S.ui.view === 'grid' ? gridHtml() : listHtml();
    if (k) restoreScroll(k);
    else if (S.ui.view === 'grid') { const n = nowFor(S.ui.day); const sc = $('.grid-scroll'); if (n != null && sc && !q.text) scrollToNow(sc, n); }
  }
  function scrollToNow(sc, n) {
    const { t0 } = M.dayRange(S.ui.day);
    const y = (n - t0) * S.set.ppm - 80;
    sc.scrollTop = Math.max(0, y);
  }

  function gridHtml() {
    const day = S.ui.day, ppm = S.set.ppm, colw = S.set.colw;
    const { t0, t1 } = M.dayRange(day);
    const g = groupsSet(), txt = q.text.trim();
    const cols = M.columns(day, g, txt, S.set.showPauses);
    if (!cols.length) return `<div class="empty"><b>Keine Treffer</b>Filter oder Suche anpassen.</div>`;
    const bodyH = (t1 - t0) * ppm;
    let axis = '';
    for (let m = t0; m <= t1; m += 60) axis += `<i style="top:${(m - t0) * ppm}px">${M.fmt(m)}</i>`;
    const head = cols.map(v => {
      const V = M.venues[v], names = M.venueNames(day, v);
      return `<button class="g-hcell" data-act="venue" data-v="${v}"><b>${esc(V.label)}</b>${V.room !== V.label ? `<span>${esc(V.room)}</span>` : ''}<span>${esc(names)}</span></button>`;
    }).join('');
    const body = cols.map(v => {
      const all = M.byDay[day].filter(s => s.v === v && (!s.pause || S.set.showPauses));
      const spines = all.filter(s => !s.pause && s.e - s.s >= 300 && all.some(o => o !== s && !o.pause && M.overlap(o, s)));
      const rest = all.filter(s => !spines.includes(s));
      const lay = M.layout(rest.filter(s => !s.pause));
      const cards = [];
      spines.forEach(s => cards.push(cardHtml(s, { ppm, t0, lane: 0, n: 1, spine: true, dim: txt && !M.matches(s, txt) })));
      rest.forEach(s => {
        const L = s.pause ? { lane: 0, n: 1 } : lay.get(s.id);
        cards.push(cardHtml(s, { ppm, t0, lane: L.lane, n: L.n, dim: txt && !M.matches(s, txt) }));
      });
      return `<div class="g-col" style="${spines.length ? '--off:16px' : ''}">${cards.join('')}</div>`;
    }).join('');
    const now = nowFor(day);
    const nowEl = now != null && now >= t0 && now <= t1 ? `<div class="nowline" style="top:${(now - t0) * ppm}px"></div>` : '';
    return `<div class="grid-scroll" style="--ppm:${ppm}px;--colw:${colw}px;--axisw:${AXIS}px;--bodyh:${bodyH}px">
      <div class="grid" style="width:${AXIS + cols.length * colw}px">
        <div class="g-head"><div class="g-corner"></div>${head}</div>
        <div class="g-body"><div class="g-axis">${axis}</div>${body}${nowEl}</div>
      </div></div>`;
  }

  function rowHtml(s, o) {
    o = o || {};
    const v = M.venues[s.v], b = M.blocks[s.b], plan = S.get(s.id);
    const flags = o.flags || [];
    let act;
    if (o.mini) {
      act = `<div class="mini"><button class="${plan === 'A' ? 'on A' : ''}" data-act="plan" data-id="${s.id}" data-p="A" aria-label="Plan A">A</button><button class="${plan === 'B' ? 'on B' : ''}" data-act="plan" data-id="${s.id}" data-p="B" aria-label="Plan B">B</button><button class="x" data-act="plan" data-id="${s.id}" data-p="" aria-label="Entfernen">${ic('x')}</button></div>`;
    } else {
      act = `<button class="star ${plan ? 'on' : ''}" data-act="star" data-id="${s.id}" aria-label="${plan ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}">${plan ? icFill('star') : ic('star')}${''}</button>${plan && plan !== 'M' ? `<span class="pl ${plan}" style="border-radius:8px;color:#fff;font-weight:800;font-size:11px;padding:0 6px;line-height:16px;background:var(--${plan === 'A' ? 'blue' : 'purple'})">${plan}</span>` : ''}`;
    }
    const sub = [s.sp, o.showBlock && b.short ? b.short : ''].filter(Boolean).join(' · ');
    return `<div class="row-item ${plan ? 'pl-' + plan : ''} ${flags.join(' ')}" data-act="card" data-id="${s.id}" role="button" tabindex="0">
      <div class="tm"><b>${M.fmt(s.s)}</b>${s.e >= 1440 ? '24:00' : M.fmt(s.e)}</div>
      <div class="bd"><div class="tt">${flags.includes('conflict') ? '<span class="warnico">⚠ </span>' : ''}${esc(s.t)}</div>
        <div class="sub"><span class="loc">${esc(vShort(v))}${v.room !== v.label ? ' · ' + esc(v.room) : ''}</span>${esc(sub)}</div></div>
      <div class="act">${act}</div></div>`;
  }

  function listHtml() {
    const day = S.ui.day, g = groupsSet(), txt = q.text.trim();
    const list = M.byDay[day].filter(s => !s.pause && g.has(M.venues[s.v].group) && M.matches(s, txt))
      .sort((a, b) => a.s - b.s || M.venueRank(a.v) - M.venueRank(b.v));
    if (!list.length) return `<div class="empty"><b>Keine Treffer</b>Filter oder Suche anpassen.</div>`;
    let out = '', cur = -1, open = false;
    for (const s of list) {
      if (s.s !== cur) {
        if (open) out += '</div>';
        cur = s.s; open = true;
        out += `<div class="sect">${M.fmt(s.s)} Uhr</div><div class="group">`;
      }
      out += rowHtml(s, { showBlock: true });
    }
    out += '</div>';
    return `<div class="scroll">${out}</div>`;
  }

  /* ---------- Mein Plan ---------- */
  function planData(day) {
    const lists = { A: S.dayList(day, 'A'), B: S.dayList(day, 'B'), M: S.dayList(day, 'M') };
    const ana = {};
    for (const p of ['A', 'B', 'M']) ana[p] = M.analyze(lists[p], S.set.speed);
    return { lists, ana };
  }
  function flagsFor(s, d) {
    const p = S.get(s.id), a = d.ana[p], f = [];
    if (a.conf.has(s.id)) f.push('conflict');
    const n = a.next.get(s.id);
    if (n && n.kind === 'direct') f.push('direct');
    else if (n && n.kind === 'tight') f.push('tight');
    return f;
  }
  function summary(p, d) {
    const L = d.lists[p], a = d.ana[p];
    const nConf = Math.ceil(a.conf.size / 2) ? countPairs(a.conf) : 0;
    const nDir = [...a.next.values()].filter(x => x.kind === 'direct').length;
    const nTight = [...a.next.values()].filter(x => x.kind === 'tight').length;
    const nFar = [...a.next.values()].filter(x => (x.kind === 'direct' || x.kind === 'tight') && x.far).length;
    let state = 'ok', text;
    if (!L.length) { return { state: '', text: 'leer', nConf: 0, nDir: 0, nTight: 0, nFar: 0, n: 0 }; }
    if (p === 'M') {
      text = nConf ? `${nConf} Überschneidung${nConf > 1 ? 'en' : ''} – bitte A/B zuordnen` : 'noch nicht zugeordnet';
      state = nConf ? 'warn' : '';
    } else if (nConf) { state = 'bad'; text = `⚠ ${nConf} Überschneidung${nConf > 1 ? 'en' : ''}`; }
    else if (nFar || nTight) { state = 'warn'; text = `✓ besuchbar, aber ${nFar ? nFar + ' weite' : nTight + ' knappe'} Weg${(nFar || nTight) > 1 ? 'e' : ''}`; }
    else if (nDir) { state = 'ok'; text = `✓ besuchbar · ${nDir} Direktanschl.`; }
    else { text = '✓ alle besuchbar'; }
    return { state, text, nConf, nDir, nTight, nFar, n: L.length };
  }
  function countPairs(conf) { let n = 0; conf.forEach(v => (n += v.length)); return n / 2; }

  function renderPlan() {
    const main = $('#main'), day = S.ui.day;
    const d = planData(day);
    const total = d.lists.A.length + d.lists.B.length + d.lists.M.length;
    const pills = ['A', 'B', 'M'].map(p => {
      const s = summary(p, d);
      return `<div class="pill ${p} ${s.state}"><b>${PLAN_NAME[p]} · ${s.n}</b><span>${esc(s.text)}</span></div>`;
    }).join('');
    const mode = S.ui.planMode;
    main.innerHTML = `
      <div class="status">${pills}</div>
      <div class="toolbar" style="border:0;padding-bottom:4px">
        <div class="seg" style="flex:1">
          <button data-act="pmode" data-m="over" aria-pressed="${mode === 'over'}">Übersicht</button>
          <button data-act="pmode" data-m="ab" aria-pressed="${mode === 'ab'}">A | B</button>
          <button data-act="pmode" data-m="list" aria-pressed="${mode === 'list'}">Liste</button>
        </div>
        ${nowFor(day) != null && mode !== 'list' ? `<button class="iconbtn" data-act="now" aria-label="Jetzt">${ic('clock')}</button>` : ''}
        ${mode !== 'list' ? `<button class="iconbtn" data-act="zoom" data-d="-0.4" aria-label="kleiner">${ic('minus')}</button><button class="iconbtn" data-act="zoom" data-d="0.4" aria-label="größer">${ic('plus')}</button>` : ''}
      </div>
      <div id="pcontent" style="display:flex;flex-direction:column;flex:1;min-height:0"></div>`;
    const el = $('#pcontent');
    if (!total) {
      el.innerHTML = `<div class="empty"><b>Noch keine Favoriten für ${esc(M.dayInfo[day].name)}</b>Im Programm einen Eintrag antippen und mit ★ merken oder direkt Plan A / Plan B zuweisen.<div class="btnrow" style="justify-content:center"><button class="btn pri" data-act="tab" data-tab="prog">Zum Programm</button></div></div>`;
      return;
    }
    el.innerHTML = mode === 'over' ? planOverview(day, d) : mode === 'ab' ? planAB(day, d) : planList(day, d);
    const sc = $('.grid-scroll');
    if (sc) { const n = nowFor(day); if (n != null) sc.scrollTop = Math.max(0, (n - sc.dataset.t0) * S.set.ppm - 80); }
  }

  function planRange(items) {
    const t0 = Math.floor((Math.min(...items.map(s => s.s)) - 20) / 60) * 60, t1 = Math.ceil((Math.max(...items.map(s => s.e)) + 20) / 60) * 60;
    return { t0: Math.max(0, t0), t1 };
  }
  function axisHtml(t0, t1, ppm) { let a = ''; for (let m = t0; m <= t1; m += 60) a += `<i style="top:${(m - t0) * ppm}px">${M.fmt(m)}</i>`; return a; }
  function nowLine(day, t0, t1, ppm) { const n = nowFor(day); return n != null && n >= t0 && n <= t1 ? `<div class="nowline" style="top:${(n - t0) * ppm}px"></div>` : ''; }

  function planOverview(day, d) {
    const all = [...d.lists.A, ...d.lists.B, ...d.lists.M];
    const { t0, t1 } = planRange(all), ppm = S.set.ppm * 1.15;
    const lay = M.layout(all);
    const cards = all.map(s => { const L = lay.get(s.id); return cardHtml(s, { ppm, t0, lane: L.lane, n: L.n, flags: flagsFor(s, d), showVenue: true }); }).join('');
    return `<div class="grid-scroll" data-t0="${t0}" style="--ppm:${ppm}px;--axisw:${AXIS}px;--bodyh:${(t1 - t0) * ppm}px">
      <div class="g-body" style="min-width:100%"><div class="g-axis">${axisHtml(t0, t1, ppm)}</div>
        <div class="g-col" style="flex:1;width:auto">${cards}</div>${nowLine(day, t0, t1, ppm)}</div></div>${legendStrip()}`;
  }
  function legendStrip() {
    return `<div style="padding:6px 12px calc(6px);font-size:11.5px;color:var(--sub);display:flex;gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);background:var(--bg)">
      <span><b style="color:var(--blue)">■</b> Plan A</span><span><b style="color:var(--purple)">■</b> Plan B</span><span><b style="color:var(--gold)">■</b> Merkliste</span>
      <span><b style="color:var(--red)">▢</b> Überschneidung</span><span><b style="color:var(--amber)">▬</b> Direktanschluss/knapp</span></div>`;
  }

  function planAB(day, d) {
    const all = [...d.lists.A, ...d.lists.B];
    const unassigned = d.lists.M;
    if (!all.length) return `<div class="scroll">${unassignedBlock(unassigned, d)}</div>`;
    const { t0, t1 } = planRange(all), ppm = S.set.ppm * 1.15;
    const col = (p, cls) => {
      const L = d.lists[p], lay = M.layout(L);
      return `<div class="pcol ${cls || ''}">${L.map(s => { const l = lay.get(s.id); return cardHtml(s, { ppm, t0, lane: l.lane, n: l.n, flags: flagsFor(s, d), showVenue: true }); }).join('')}</div>`;
    };
    return `<div class="grid-scroll" data-t0="${t0}" style="--ppm:${ppm}px;--axisw:${AXIS}px;--bodyh:${(t1 - t0) * ppm}px">
      <div class="g-head"><div class="g-corner"></div><div class="planhead" style="flex:1;position:static;border:0"><div class="A" style="flex:1">Plan A (${d.lists.A.length})</div><div class="B" style="flex:1;border-right:0">Plan B (${d.lists.B.length})</div></div></div>
      <div class="g-body" style="min-width:100%"><div class="g-axis">${axisHtml(t0, t1, ppm)}</div>
        <div class="plancols" style="flex:1">${col('A')}${col('B', 'single')}</div>${nowLine(day, t0, t1, ppm)}</div></div>
      ${unassigned.length ? `<div style="max-height:30%;overflow:auto;border-top:1px solid var(--line)">${unassignedBlock(unassigned, d)}</div>` : ''}${legendStrip()}`;
  }
  function unassignedBlock(list, d) {
    return `<div class="sect">Noch nicht zugeordnet (${list.length})</div><div class="group">${list.map(s => rowHtml(s, { mini: true, flags: flagsFor(s, d) })).join('')}</div>`;
  }

  function hintHtml(s, d) {
    const p = S.get(s.id), a = d.ana[p];
    let out = '';
    (a.conf.get(s.id) || []).forEach(oid => {
      const o = M.byId[oid];
      if (o.s < s.s || (o.s === s.s && oid < s.id)) return; // jede Überschneidung nur einmal anzeigen
      out += `<div class="hint red">${ic('warn')}<div>Überschneidung mit <button data-act="card" data-id="${oid}">${esc(o.t.length > 70 ? o.t.slice(0, 68) + '…' : o.t)}</button> (${M.range(o)}, ${esc(vShort(M.venues[o.v]))})${p !== 'M' ? ' – einen Termin in Plan B/Merkliste verschieben?' : ''}</div></div>`;
    });
    const n = a.next.get(s.id);
    if (n && (n.kind === 'direct' || n.kind === 'tight')) {
      const to = M.byId[n.to], va = M.venues[s.v], vb = M.venues[to.v];
      const where = `${esc(vShort(va))} → ${esc(vShort(vb))}`;
      const base = n.kind === 'direct' ? `Direktanschluss (${where})` : `Nur ${n.gap} Min. Pause (${where})`;
      const far = n.far ? ' – <b>weit auseinander</b>' : '';
      out += `<div class="hint">${ic('walk')}<div>${base}: ${M.walkLabel(n.walk)}${far}. <button data-act="route" data-a="${s.v}" data-b="${to.v}">Auf der Karte zeigen</button></div></div>`;
    }
    return out;
  }
  function planList(day, d) {
    let out = '';
    for (const p of ['A', 'B', 'M']) {
      const L = d.ana[p].sorted;
      if (!L.length) continue;
      const sm = summary(p, d);
      out += `<div class="sect"><span>${PLAN_NAME[p]}</span><span class="sp"></span><span style="text-transform:none;letter-spacing:0;font-weight:600;color:var(--${sm.state === 'bad' ? 'red' : sm.state === 'warn' ? 'amber' : sm.state === 'ok' ? 'green' : 'sub'})">${esc(sm.text)}</span></div><div class="group">`;
      L.forEach(s => { out += rowHtml(s, { mini: true, flags: flagsFor(s, d) }) + hintHtml(s, d); });
      out += '</div>';
    }
    return `<div class="scroll">${out}<div style="margin:18px 12px 0;font-size:12.5px;color:var(--sub)">Überschneidungen werden nur <b>innerhalb</b> von Plan A, Plan B und der Merkliste geprüft. Zwischen Plan A und Plan B darf es Überschneidungen geben. Wegzeiten sind grobe Schätzungen anhand des Standplans.</div></div>`;
  }

  /* ---------- Details ---------- */
  function issuesFor(id, plan) {
    const s = M.byId[id];
    const list = S.dayList(s.day, plan).filter(x => x.id !== id).concat([s]);
    const a = M.analyze(list, S.set.speed);
    const out = { conf: (a.conf.get(id) || []).map(x => M.byId[x]), prev: null, next: null };
    const nx = a.next.get(id);
    if (nx && (nx.kind === 'direct' || nx.kind === 'tight')) out.next = Object.assign({ s: M.byId[nx.to] }, nx);
    for (const x of a.sorted) { const n = a.next.get(x.id); if (n && n.to === id && (n.kind === 'direct' || n.kind === 'tight')) out.prev = Object.assign({ s: x }, n); }
    return out;
  }
  function issueHtml(id, plan) {
    const iss = issuesFor(id, plan), nm = PLAN_NAME[plan];
    let h = '';
    iss.conf.forEach(o => (h += `<div class="warnbox">${ic('warn')} <b>Überschneidung in ${nm}</b> mit „${esc(o.t)}“ (${M.range(o)}, ${esc(vShort(M.venues[o.v]))})</div>`));
    const t = (x, dir) => {
      const far = x.far ? ' – <b>weit auseinander</b>' : '';
      const txt = dir === 'prev' ? `Direkt davor: „${esc(x.s.t)}“ (${esc(vShort(M.venues[x.s.v]))})` : `Direkt danach: „${esc(x.s.t)}“ (${esc(vShort(M.venues[x.s.v]))})`;
      const kind = x.kind === 'direct' ? 'Direktanschluss' : `Nur ${x.gap} Min. Pause`;
      return `<div class="warnbox amber">${ic('walk')} <b>${kind}</b> in ${nm}. ${txt}: ${M.walkLabel(x.walk)}${far}.</div>`;
    };
    if (iss.prev) h += t(iss.prev, 'prev');
    if (iss.next) h += t(iss.next, 'next');
    return h;
  }

  function openSession(id) {
    const s = M.byId[id], v = M.venues[s.v], b = M.blocks[s.b], plan = S.get(id);
    const day = M.dayStr(s.day);
    const sibl = M.byDay[s.day].filter(x => x.b === s.b && !x.pause);
    const allFav = sibl.every(x => S.get(x.id));
    let hints = '';
    if (plan) hints = issueHtml(id, plan);
    else {
      ['A', 'B'].forEach(p => {
        const iss = issuesFor(id, p);
        if (iss.conf.length) hints += `<div class="warnbox amber">In <b>${PLAN_NAME[p]}</b> würde sich das überschneiden mit „${esc(iss.conf[0].t)}“ (${M.range(iss.conf[0])})${iss.conf.length > 1 ? ' u. a.' : ''}.</div>`;
      });
    }
    const links = (b.links || []).map(l => `<a href="${esc(l.u)}" target="_blank" rel="noopener">${ic('link')} ${esc(l.t)}</a>`).join('');
    U.sheet.show(`
      <h2>${esc(s.t)}</h2>
      <div class="meta"><b>${esc(day)}</b> · ${M.range(s)} Uhr (${s.e - s.s} Min.)</div>
      <div class="meta">${ic('pin')} <b>${esc(v.label)}</b>${v.room !== v.label ? ' · ' + esc(v.room) : ''} · ${esc(v.level)}</div>
      ${s.sp ? `<div class="meta">${esc(s.sp)}</div>` : ''}
      <div class="box"><h3>Meine Auswahl</h3>
        <div class="seg" role="group" aria-label="Auswahl">
          <button data-act="plan" data-id="${id}" data-p="" class="${!plan ? 'on' : ''}">Aus</button>
          <button data-act="plan" data-id="${id}" data-p="M" class="M ${plan === 'M' ? 'on' : ''}">★ Merken</button>
          <button data-act="plan" data-id="${id}" data-p="A" class="A ${plan === 'A' ? 'on' : ''}">Plan A</button>
          <button data-act="plan" data-id="${id}" data-p="B" class="B ${plan === 'B' ? 'on' : ''}">Plan B</button>
        </div>${hints}</div>
      <div class="box"><h3>Programmpunkt</h3><div class="note"><b>${esc(b.title)}</b></div>${b.note ? `<div class="note">${esc(b.note)}</div>` : ''}${links ? `<div class="links">${links}</div>` : ''}
        <div class="btnrow"><button class="btn" data-act="map" data-v="${s.v}">${ic('map')} Auf der Karte</button>
        <button class="btn" data-act="block" data-b="${b.id}" data-on="${allFav ? 0 : 1}">${allFav ? 'Ganzes Forum entfernen' : 'Alle Vorträge merken (' + sibl.length + ')'}</button>
        <button class="btn" data-act="venue" data-v="${s.v}">Alles an diesem Ort</button></div></div>
      <div class="btnrow"><button class="btn pri" data-act="sheet-close" style="flex:1">Fertig</button></div>`);
  }

  function openVenue(vid) {
    const v = M.venues[vid], day = S.ui.day;
    const blocks = M.dayBlocks(day, vid);
    const ss = M.byDay[day].filter(s => s.v === vid && !s.pause).sort((a, b) => a.s - b.s);
    U.sheet.show(`
      <h2>${esc(v.label)}</h2>
      <div class="meta">${ic('pin')} <b>${esc(v.room)}</b> · ${esc(v.level)}</div>
      ${blocks.map(b => `<div class="box"><h3>${esc(M.dayInfo[day].name)}</h3><div class="note"><b>${esc(b.title)}</b></div>${b.note ? `<div class="note">${esc(b.note)}</div>` : ''}
        ${b.links.length ? `<div class="links">${b.links.map(l => `<a href="${esc(l.u)}" target="_blank" rel="noopener">${ic('link')} ${esc(l.t)}</a>`).join('')}</div>` : ''}</div>`).join('') || '<div class="box">Für diesen Tag ist hier kein Programm eingetragen.</div>'}
      ${ss.length ? `<div class="group" style="margin:10px 0 0">${ss.map(s => rowHtml(s)).join('')}</div>` : ''}
      <div class="btnrow"><button class="btn" data-act="map" data-v="${vid}">${ic('map')} Auf der Karte</button><button class="btn pri" data-act="sheet-close" style="flex:1">Schließen</button></div>`);
  }

  /* ---------- Karte ---------- */
  function renderMap() {
    const day = S.ui.day;
    const focus = S.ui.mapFocus || [];
    if (focus.length) { const f = M.venues[focus[0]].floor; if (f) S.ui.floor = f; }
    const fl = S.ui.floor;
    $('#main').innerHTML = `
      <div class="toolbar" style="padding-bottom:6px;flex-wrap:nowrap"><div class="seg" style="flex:1">
        ${[['EG', 'Erdgeschoss'], ['OG', 'Obergeschoss'], ['UG', 'Untergeschoss']].map(([k, l]) => `<button data-act="floor" data-f="${k}" aria-pressed="${fl === k}">${l}</button>`).join('')}</div>
        <button class="iconbtn" data-act="mapall" aria-pressed="${!!S.ui.mapAll}" aria-label="Alle Orte zeigen">${ic('pin')}</button></div>
      <div class="mapwrap" id="mapwrap"></div>`;
    const pins = [];
    const plans = {};
    S.dayList(day).forEach(s => { const p = S.get(s.id); const cur = plans[s.v]; if (!cur || 'ABM'.indexOf(p) < 'ABM'.indexOf(cur)) plans[s.v] = p; });
    const withProg = new Set(M.byDay[day].filter(s => !s.pause).map(s => s.v));
    const seenPos = new Set();
    Object.values(M.venues).forEach(v => {
      if (v.floor !== fl) return;
      const isFocus = focus.includes(v.id), pl = plans[v.id];
      if (!isFocus && !pl && !(S.ui.mapAll && withProg.has(v.id))) return;
      pins.push({ v, cls: isFocus ? 'focus' : pl ? pl : 'dot' });
    });
    mapCtl = window.MapView.mount($('#mapwrap'), {
      floor: fl, pins, focus: focus.filter(f => M.venues[f].floor === fl),
      line: focus.length === 2 && M.venues[focus[0]].floor === fl && M.venues[focus[1]].floor === fl ? focus : null,
      onPin: id => openVenue(id), labelOf: v => vShort(v)
    });
    S.ui.mapFocus = null;
  }

  /* ---------- Info ---------- */
  function seg(name, opts, cur) {
    return `<div class="seg">${opts.map(([k, l]) => `<button data-act="set" data-k="${name}" data-v="${k}" aria-pressed="${String(cur) === String(k)}">${l}</button>`).join('')}</div>`;
  }
  function renderInfo() {
    const c = S.counts();
    $('#main').innerHTML = `<div class="scroll">
      ${S.storageOk ? '' : `<div class="warnbox amber" style="margin:12px">Der Browser erlaubt kein dauerhaftes Speichern (z. B. privater Modus). Favoriten gehen beim Schließen verloren – bitte per „Sichern“ exportieren.</div>`}
      <div class="sect">Mein Plan</div><div class="group" style="padding:2px 14px">
        <div class="toggle"><div>Favoriten gesamt<small>Plan A: ${c.A} · Plan B: ${c.B} · Merkliste: ${c.M}</small></div></div>
        <div class="infolist">
          <button class="lnk" data-act="ics">Kalender-Export (.ics)<span style="color:var(--sub)">›</span></button>
          <button class="lnk" data-act="share">Plan teilen (Link)<span style="color:var(--sub)">›</span></button>
          <button class="lnk" data-act="print">Drucken / als PDF sichern<span style="color:var(--sub)">›</span></button>
          <button class="lnk" data-act="backup">Sicherung (JSON) laden / speichern<span style="color:var(--sub)">›</span></button>
        </div></div>
      <div class="sect">Einstellungen</div><div class="group" style="padding:4px 14px">
        <div class="toggle"><div>Stern setzt direkt Plan A<small>Sonst landen neue Favoriten zuerst in der Merkliste.</small></div><button class="sw" role="switch" data-act="set" data-k="starPlan" data-v="${S.set.starPlan === 'A' ? 'M' : 'A'}" aria-checked="${S.set.starPlan === 'A'}"></button></div>
        <div class="toggle"><div>Spaltenbreite</div>${seg('colw', [[104, 'schmal'], [132, 'normal'], [168, 'breit']], S.set.colw)}</div>
        <div class="toggle"><div>Gehtempo<small>für die Wegzeit-Schätzung</small></div>${seg('speed', [['slow', 'ruhig'], ['normal', 'normal'], ['fast', 'zügig']], S.set.speed)}</div>
        <div class="toggle"><div>Pausen im Raster zeigen<small>Kaffee-/Mittagspausen und Diskussionsslots</small></div><button class="sw" role="switch" data-act="set" data-k="showPauses" data-v="${!S.set.showPauses}" aria-checked="${!!S.set.showPauses}"></button></div>
        <div class="toggle"><div>Kalender-Erinnerung<small>Vorlauf im .ics-Export</small></div>${seg('alarm', [[0, 'aus'], [5, '5′'], [10, '10′'], [15, '15′']], S.set.alarm)}</div>
      </div>
      <div class="sect">Legende</div><div class="group" style="padding:12px 14px"><div class="legend">
        <span class="sw2" style="background:var(--blue-bg);border-color:var(--blue-line);border-left-color:var(--blue)"></span><span><b>Plan A</b> – mein Hauptplan, wird auf Überschneidungen geprüft</span>
        <span class="sw2" style="background:var(--purple-bg);border-color:var(--purple-line);border-left-color:var(--purple)"></span><span><b>Plan B</b> – Alternative, darf sich mit Plan A überschneiden</span>
        <span class="sw2" style="background:var(--gold-bg);border-color:var(--gold);border-left-color:var(--gold)"></span><span><b>Merkliste</b> – gemerkt, noch ohne A/B</span>
        <span class="sw2" style="background:var(--card2);outline:2px solid var(--red);outline-offset:-2px"></span><span>Überschneidung innerhalb eines Plans</span>
        <span class="sw2" style="background:var(--card2);box-shadow:inset 0 -5px 0 var(--amber)"></span><span>Direktanschluss (0 Min. Pause) bzw. knapper Wechsel zwischen verschiedenen Orten</span>
      </div></div>
      <div class="sect">Konferenz-Links</div><div class="group" style="padding:2px 14px"><div class="infolist">${P.nav.map(n => `<a href="${esc(n.u)}" target="_blank" rel="noopener">${esc(n.t)}</a>`).join('')}</div></div>
      <div class="sect">Hinweise</div><div class="group" style="padding:10px 14px;font-size:13.5px;color:var(--sub)">
        Programmstand: ${esc(P.source.replace('https://', ''))}, abgerufen am 9.11.2026. Änderungen der Veranstalter bitte immer dort gegenprüfen. Raumzuordnung und Lageplan: Standplan Linstow 2026.<br><br>
        Alle Daten (Favoriten, Pläne) bleiben auf diesem Gerät im Browser gespeichert – es gibt keinen Server.<br><br>
        <button class="btn danger" data-act="reset">Alle Favoriten löschen</button></div>
    </div>`;
  }

  /* ---------- Export / Teilen ---------- */
  function openIcs() {
    const c = S.counts();
    U.sheet.show(`<h2>Kalender-Export</h2><div class="meta">Zeiten in Europe/Berlin, mit Raum/Ort und Link. Funktioniert mit iOS-Kalender, Google und Outlook.</div>
      <div class="box"><h3>Was exportieren?</h3><div class="seg" id="icsplans">
        <button data-p="A" class="on">Plan A (${c.A})</button><button data-p="B">Plan B (${c.B})</button><button data-p="AB">A + B (${c.A + c.B})</button><button data-p="ABM">Alles (${c.A + c.B + c.M})</button></div>
        <div class="meta" style="margin-top:8px">Plan-B-Termine erhalten den Titelzusatz „[Plan B]“.</div></div>
      <div class="btnrow"><button class="btn pri" data-act="ics-dl">Datei laden</button><button class="btn" data-act="ics-share">Teilen …</button><button class="btn" data-act="sheet-close">Abbrechen</button></div>`,
      sh => $$('#icsplans button', sh).forEach(b => b.addEventListener('click', () => { $$('#icsplans button', sh).forEach(x => x.classList.remove('on')); b.classList.add('on'); })));
  }
  function icsFile() {
    const sel = ($('#icsplans button.on') || {}).dataset;
    const plans = (sel ? sel.p : 'A').split('');
    const r = window.Ics.build(plans);
    if (!r.count) { toast('Keine Einträge für diese Auswahl'); return null; }
    return new File([r.text], 'windenergietage-2026-' + plans.join('').toLowerCase() + '.ics', { type: 'text/calendar' });
  }
  function download(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function openShare() {
    const url = S.shareUrl(), c = S.counts();
    U.sheet.show(`<h2>Plan teilen</h2><div class="meta">Der Link enthält Plan A (${c.A}), Plan B (${c.B}) und Merkliste (${c.M}). Wer ihn öffnet, kann den Plan übernehmen.</div>
      <div class="box"><input id="shareurl" readonly value="${esc(url)}" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--card);font-size:13px"></div>
      <div class="btnrow"><button class="btn pri" data-act="copy">Link kopieren</button>${navigator.share ? '<button class="btn" data-act="nativeshare">Teilen …</button>' : ''}<button class="btn" data-act="sheet-close">Schließen</button></div>`);
  }
  function openBackup() {
    U.sheet.show(`<h2>Sicherung</h2><div class="meta">Favoriten als Datei speichern oder aus einer Sicherung wiederherstellen.</div>
      <div class="btnrow"><button class="btn pri" data-act="exportjson">Sicherung speichern</button><label class="btn" style="cursor:pointer">Datei wählen …<input type="file" id="impfile" accept="application/json,.json" hidden></label></div>
      <div class="btnrow"><button class="btn" data-act="sheet-close">Schließen</button></div>`,
      sh => $('#impfile', sh).addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try { const obj = JSON.parse(await f.text()); const n = S.importObj(obj, confirm('Bestehende Favoriten ersetzen?\n\nOK = ersetzen, Abbrechen = zusammenführen') ? 'replace' : 'merge'); toast(n + ' Einträge übernommen'); U.sheet.close(); render(); }
        catch (err) { toast('Datei konnte nicht gelesen werden'); }
      }));
  }
  function openImport(txt) {
    const imp = S.decode(txt), n = Object.keys(imp).length;
    if (!n) return;
    const c = { A: 0, B: 0, M: 0 }; Object.values(imp).forEach(p => c[p]++);
    U.sheet.show(`<h2>Geteilten Plan öffnen?</h2><div class="meta">Enthält ${n} Einträge: Plan A ${c.A}, Plan B ${c.B}, Merkliste ${c.M}.</div>
      <div class="meta" style="margin-top:6px">Du hast aktuell ${Object.keys(S.fav).length} eigene Favoriten.</div>
      <div class="btnrow"><button class="btn pri" data-act="imp" data-m="merge">Zusammenführen</button><button class="btn" data-act="imp" data-m="replace">Meinen Plan ersetzen</button><button class="btn" data-act="imp" data-m="no">Verwerfen</button></div>`);
    openImport.data = imp;
  }
  function printPlan() {
    const area = $('#print-area');
    let h = `<h1>Windenergietage 2026 – mein Plan</h1><div>Linstow · Stand ${new Date().toLocaleDateString('de-DE')} · Quelle: ${esc(P.source)}</div>`;
    for (const day of M.days) {
      const d = planData(day.id);
      if (!d.lists.A.length && !d.lists.B.length && !d.lists.M.length) continue;
      h += `<div class="day"><h2>${esc(M.dayStr(day.id))}</h2>`;
      for (const p of ['A', 'B', 'M']) {
        const L = d.ana[p].sorted; if (!L.length) continue;
        h += `<h3>${PLAN_NAME[p]}</h3><table>`;
        L.forEach(s => {
          const v = M.venues[s.v], fl = [];
          if (d.ana[p].conf.has(s.id)) fl.push('<span class="w">⚠ Überschneidung</span>');
          const n = d.ana[p].next.get(s.id);
          if (n && (n.kind === 'direct' || n.kind === 'tight')) fl.push(`<span class="a">${n.kind === 'direct' ? 'Direktanschluss' : 'knapp'} → ${esc(vShort(M.venues[M.byId[n.to].v]))} (${M.walkLabel(n.walk)})</span>`);
          h += `<tr><td class="t">${M.range(s)}</td><td class="l">${esc(v.label)}<br>${esc(v.room !== v.label ? v.room : '')}</td><td><b>${esc(s.t)}</b>${s.sp ? '<br>' + esc(s.sp) : ''}${fl.length ? '<br>' + fl.join(' · ') : ''}</td></tr>`;
        });
        h += '</table>';
      }
      h += '</div>';
    }
    area.innerHTML = h;
    window.print();
  }

  /* ---------- Aktionen ---------- */
  function setPlan(id, plan, quiet) {
    S.setPlan(id, plan || null);
    if (!quiet) { const s = M.byId[id]; toast(plan ? `${PLAN_NAME[plan]}: ${s.t.length > 40 ? s.t.slice(0, 38) + '…' : s.t}` : 'Entfernt'); }
    afterChange(id);
  }
  function afterChange(id) {
    const open = U.sheet.isOpen();
    renderTop();
    if (S.ui.tab === 'prog') { fillProg(true); }
    else if (S.ui.tab === 'plan') render({ keep: true });
    else if (S.ui.tab === 'map') render();
    else render({ keep: true });
    if (open && id && $('.sheet h2') && M.byId[id]) { const cur = $('.sheet h2').textContent; if (cur === M.byId[id].t) openSession(id); }
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    if (t.closest('.row-item') && t.closest('.row-item') !== t && (a === 'star' || a === 'plan' || a === 'card' && t.tagName === 'BUTTON')) { /* innere Buttons zuerst */ }
    switch (a) {
      case 'tab': S.ui.tab = t.dataset.tab; render(); break;
      case 'day': S.ui.day = t.dataset.day; render(); break;
      case 'view': S.ui.view = t.dataset.view; render(); break;
      case 'grp': { const g = groupsSet(); const k = t.dataset.g; g.has(k) ? g.delete(k) : g.add(k); S.ui.groups = g.size === M.groups.length ? null : [...g]; renderProg(); S.save(); break; }
      case 'zoom': S.set.ppm = Math.min(4, Math.max(0.8, +(S.set.ppm + parseFloat(t.dataset.d)).toFixed(2))); S.save(); S.ui.tab === 'prog' ? fillProg(true) : render({ keep: true }); break;
      case 'now': { const sc = $('.grid-scroll'); const n = nowFor(S.ui.day); if (sc && n != null) { const t0 = sc.dataset.t0 != null ? +sc.dataset.t0 : M.dayRange(S.ui.day).t0; sc.scrollTo({ top: Math.max(0, (n - t0) * (S.ui.tab === 'plan' ? S.set.ppm * 1.15 : S.set.ppm) - 80), behavior: 'smooth' }); } break; }
      case 'card': if (e.target.closest('[data-act="star"],[data-act="plan"]') && e.target.closest('[data-act="star"],[data-act="plan"]') !== t) return; openSession(t.dataset.id); break;
      case 'star': { e.stopPropagation(); const id = t.dataset.id; setPlan(id, S.get(id) ? null : (S.set.starPlan === 'A' ? 'A' : 'M')); break; }
      case 'plan': e.stopPropagation(); { const id = t.dataset.id, p = t.dataset.p; setPlan(id, S.get(id) === p ? (p ? null : null) : p); } break;
      case 'venue': openVenue(t.dataset.v); break;
      case 'map': U.sheet.close(); S.ui.mapFocus = [t.dataset.v]; S.ui.tab = 'map'; render(); break;
      case 'route': U.sheet.close(); S.ui.mapFocus = [t.dataset.a, t.dataset.b]; S.ui.tab = 'map'; render(); break;
      case 'floor': S.ui.floor = t.dataset.f; S.ui.mapFocus = null; render(); break;
      case 'mapall': S.ui.mapAll = !S.ui.mapAll; render(); break;
      case 'pmode': S.ui.planMode = t.dataset.m; render(); break;
      case 'block': {
        const on = t.dataset.on === '1';
        M.byDay[M.blocks[t.dataset.b].day].filter(s => s.b === t.dataset.b && !s.pause).forEach(s => { if (on) { if (!S.get(s.id)) S.fav[s.id] = S.set.starPlan === 'A' ? 'A' : 'M'; } else delete S.fav[s.id]; });
        S.save(); toast(on ? 'Alle Vorträge gemerkt' : 'Entfernt'); const id = $('.sheet h2') ? $$('[data-act="plan"]', $('.sheet'))[0].dataset.id : null; afterChange(id); break;
      }
      case 'sheet-close': U.sheet.close(); break;
      case 'set': { const k = t.dataset.k; let v = t.dataset.v; if (['colw', 'alarm'].includes(k)) v = +v; if (v === 'true') v = true; if (v === 'false') v = false; S.set[k] = v; S.save(); render({ keep: true }); break; }
      case 'ics': openIcs(); break;
      case 'ics-dl': { const f = icsFile(); if (f) { download(f); toast('Kalenderdatei erstellt'); } break; }
      case 'ics-share': { const f = icsFile(); if (!f) break; if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: 'Windenergietage 2026' }).catch(() => {}); else { download(f); toast('Teilen nicht verfügbar – Datei geladen'); } break; }
      case 'share': openShare(); break;
      case 'copy': { const i = $('#shareurl'); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => toast('Link kopiert'), () => { document.execCommand && document.execCommand('copy'); toast('Link kopiert'); }); break; }
      case 'nativeshare': navigator.share({ title: 'Mein Plan – Windenergietage 2026', url: S.shareUrl() }).catch(() => {}); break;
      case 'print': printPlan(); break;
      case 'backup': openBackup(); break;
      case 'exportjson': download(new File([S.exportJson()], 'windenergietage-2026-sicherung.json', { type: 'application/json' })); break;
      case 'reset': if (confirm('Wirklich alle Favoriten (Plan A, Plan B, Merkliste) löschen?')) { S.clear(); toast('Gelöscht'); render(); } break;
      case 'imp': { const m = t.dataset.m; if (m !== 'no') { const n = S.importObj(openImport.data, m); toast(n + ' Einträge übernommen'); } history.replaceState(null, '', location.pathname + location.search); U.sheet.close(); render(); break; }
    }
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.row-item[data-act="card"]')) { e.preventDefault(); openSession(e.target.dataset.id); }
  });
  let qt;
  document.addEventListener('input', e => {
    if (e.target.id !== 'q') return;
    clearTimeout(qt);
    qt = setTimeout(() => { q.text = e.target.value; fillProg(); }, 160);
  });

  /* ---------- Start ---------- */
  function init() {
    S.load();
    if (!S.ui.day || !M.dayInfo[S.ui.day]) S.ui.day = 'di';
    const n = berlinNow(); const today = M.days.find(d => d.date === n.date);
    if (today) S.ui.day = today.id;
    if (!S.set.ppm) Object.assign(S.set, CFG.defaults, S.set);
    for (const k of Object.keys(CFG.defaults)) if (S.set[k] === undefined) S.set[k] = CFG.defaults[k];
    render();
    const m = /[#&]p=([^&]*)/.exec(location.hash);
    if (m) setTimeout(() => openImport(decodeURIComponent(m[1])), 300);
    setInterval(() => { if (S.ui.tab === 'prog' && S.ui.view === 'grid' || S.ui.tab === 'plan') { const nl = $('.nowline'); if (nl) fillNow(); } }, 60000);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  function fillNow() { if (S.ui.tab === 'prog') fillProg(true); else if (S.ui.tab === 'plan') render({ keep: true }); }
  window.App = { render, openSession, S, M };
  document.addEventListener('DOMContentLoaded', init);
})();
