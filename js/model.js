/* Datenmodell: Zugriff auf Programm, Überschneidungen, Anschlüsse, Wegzeiten */
(function () {
  'use strict';
  const P = window.PROGRAM, CFG = window.CFG;
  const M = (window.Model = {});

  M.days = P.days;
  M.venues = P.venues;
  M.blocks = Object.fromEntries(P.blocks.map(b => [b.id, b]));
  M.sessions = P.sessions;
  M.byId = Object.fromEntries(P.sessions.map(s => [s.id, s]));
  M.byDay = {};
  M.days.forEach(d => (M.byDay[d.id] = P.sessions.filter(s => s.day === d.id)));
  M.dayInfo = Object.fromEntries(M.days.map(d => [d.id, d]));

  const GROUPS = [
    ['OG', 'Obergeschoss'], ['EG', 'Erdgeschoss'], ['Zelt', 'Zelt'], ['UG', 'Untergeschoss & Spaß'],
    ['Häuser', 'Themenhäuser'], ['Tische', 'Thementische'], ['Extras', 'Extras']
  ];
  M.groups = GROUPS;

  function rank(key) {
    const m = /^([A-Z]+)(\d*)([AB]?)$/.exec(key);
    const pre = { BC: 0, EA: 1, F: 2, H: 3, T: 4 }[m[1]] ?? 5;
    return pre * 100000 + (parseInt(m[2] || '0', 10) * 10) + (m[3] ? (m[3] === 'A' ? 1 : 2) : 0);
  }
  M.venueRank = rank;

  /* Zeitbereich eines Tages (Minuten), auf volle Stunden gerundet */
  M.dayRange = function (day) {
    const ss = M.byDay[day].filter(s => !s.pause);
    return { t0: Math.floor(Math.min(...ss.map(s => s.s)) / 60) * 60, t1: Math.ceil(Math.max(...ss.map(s => s.e)) / 60) * 60 };
  };

  /* Spalten (Orte) eines Tages, die Programm haben */
  M.columns = function (day, groups, q, showPauses) {
    const set = new Set();
    M.byDay[day].forEach(s => {
      if (s.pause && !showPauses) return;
      if (groups && !groups.has(M.venues[s.v].group)) return;
      if (q && !M.matches(s, q)) return;
      set.add(s.v);
    });
    return [...set].sort((a, b) => rank(a) - rank(b));
  };

  M.dayBlocks = (day, v) => P.blocks.filter(b => b.day === day && b.v === v);
  M.venueNames = function (day, v) {
    const ns = M.dayBlocks(day, v).filter(b => M.byDay[day].some(s => s.b === b.id)).map(b => b.short).filter(Boolean);
    return [...new Set(ns)].join(' / ');
  };

  /* Orte ohne Zeitprogramm an einem Tag (z. B. „Programm folgt“) */
  M.venuesWithoutTimes = function (day) {
    const withS = new Set(M.byDay[day].map(s => s.v));
    return P.blocks.filter(b => b.day === day && !withS.has(b.v));
  };

  const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  M.norm = norm;
  const hay = new Map();
  M.matches = function (s, q) {
    q = norm(q).trim();
    if (!q) return true;
    let h = hay.get(s.id);
    if (!h) {
      const v = M.venues[s.v], b = M.blocks[s.b];
      h = norm([s.t, s.sp, b.title, b.short, v.label, v.room].join(' | '));
      hay.set(s.id, h);
    }
    return q.split(/\s+/).every(w => h.includes(w));
  };

  const fmt = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  M.fmt = fmt;
  M.range = s => fmt(s.s) + '–' + (s.e >= 1440 ? '24:00' : fmt(s.e));
  M.overlap = (a, b) => a.s < b.e && b.s < a.e;

  /* Wegzeit in Minuten zwischen zwei Orten (grobe Schätzung auf Basis der Kartenpositionen) */
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  M.walkMin = function (va, vb, speedKey) {
    if (typeof va === 'string') va = M.venues[va];
    if (typeof vb === 'string') vb = M.venues[vb];
    if (va.id === vb.id) return 0;
    const sp = CFG.speeds[speedKey || 'normal'] || CFG.speeds.normal;
    let units;
    if (va.floor === vb.floor) units = dist(va.u, vb.u);
    else units = dist(va.u, CFG.stairs[va.floor]) + dist(vb.u, CFG.stairs[vb.floor]);
    let m = (units * CFG.metersPerUnit) / sp;
    if (va.floor !== vb.floor) m += CFG.floorChangeMin;
    const out = v => v.group === 'Häuser';
    if (out(va) || out(vb)) m = m * CFG.outdoorFactor + 0.5;
    return m + CFG.doorMin;
  };
  M.walkLabel = function (min) {
    const r = Math.max(1, Math.round(min));
    return 'ca. ' + r + ' Min. Fußweg';
  };

  /* Spuren-Layout: überlappende Einträge nebeneinander */
  M.layout = function (items) {
    const sorted = items.slice().sort((a, b) => a.s - b.s || b.e - a.e);
    const out = new Map();
    let cluster = [], lanes = [], cEnd = -1;
    const flush = () => { cluster.forEach(it => (out.get(it.id).n = lanes.length)); cluster = []; lanes = []; cEnd = -1; };
    for (const it of sorted) {
      if (cluster.length && it.s >= cEnd) flush();
      let lane = lanes.findIndex(end => end <= it.s);
      if (lane < 0) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = it.e;
      cEnd = Math.max(cEnd, it.e);
      out.set(it.id, { lane, n: 1 });
      cluster.push(it);
    }
    flush();
    return out;
  };

  /* Analyse einer Liste von Einträgen eines Plans:
     conf: id -> [ids der überschneidenden Einträge]
     next: id -> { to, gap, walk, kind } für den nächsten Eintrag (kind: direct | tight | near) */
  M.analyze = function (list, speedKey) {
    const L = list.slice().sort((a, b) => a.s - b.s || a.e - b.e);
    const conf = new Map(), next = new Map();
    for (let i = 0; i < L.length; i++) {
      for (let j = i + 1; j < L.length; j++) {
        if (L[j].s >= L[i].e) break;
        if (M.overlap(L[i], L[j])) {
          (conf.get(L[i].id) || conf.set(L[i].id, []).get(L[i].id)).push(L[j].id);
          (conf.get(L[j].id) || conf.set(L[j].id, []).get(L[j].id)).push(L[i].id);
        }
      }
    }
    for (const a of L) {
      let best = null;
      for (const b of L) {
        if (b === a || b.s < a.e) continue;
        if (!best || b.s < best.s) best = b;
      }
      if (!best) continue;
      const gap = best.s - a.e;
      if (a.v === best.v) { if (gap === 0) next.set(a.id, { to: best.id, gap, walk: 0, kind: 'same' }); continue; }
      const walk = M.walkMin(a.v, best.v, speedKey);
      let kind = null;
      if (gap === 0) kind = 'direct';
      else if (gap <= CFG.tightLookMin && walk > gap && walk >= 2) kind = 'tight';
      if (kind) next.set(a.id, { to: best.id, gap, walk, kind, far: walk >= CFG.farMin });
    }
    return { conf, next, sorted: L };
  };

  M.dayStr = function (id) {
    const d = M.dayInfo[id];
    const [y, m, dd] = d.date.split('-');
    return d.name + ', ' + parseInt(dd, 10) + '.' + parseInt(m, 10) + '.' + y;
  };
})();
