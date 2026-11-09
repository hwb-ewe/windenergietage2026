/* Zustand, lokale Speicherung (localStorage), Teilen-Link, Export/Import */
(function () {
  'use strict';
  const CFG = window.CFG, M = window.Model;
  const KEY = 'wet26.v1';
  let mem = null, storageOk = true;

  const S = (window.Store = {
    fav: {},                       // sessionId -> 'A' | 'B' | 'M'
    set: Object.assign({}, CFG.defaults),
    ui: { tab: 'prog', day: null, view: 'grid', planMode: 'over', floor: 'EG', groups: null },
    listeners: [],
    storageOk: true
  });

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { storageOk = false; return mem; }
  }
  S.load = function () {
    const d = read();
    if (d) {
      if (d.fav) for (const [id, p] of Object.entries(d.fav)) if (M.byId[id] && !M.byId[id].pause && 'ABM'.includes(p)) S.fav[id] = p;
      Object.assign(S.set, d.set || {});
      Object.assign(S.ui, d.ui || {});
    }
    S.storageOk = storageOk;
  };
  S.save = function () {
    const d = { fav: S.fav, set: S.set, ui: { tab: S.ui.tab, day: S.ui.day, view: S.ui.view, planMode: S.ui.planMode, floor: S.ui.floor, groups: S.ui.groups } };
    mem = d;
    try { localStorage.setItem(KEY, JSON.stringify(d)); S.storageOk = true; } catch (e) { S.storageOk = false; }
  };
  S.setPlan = function (id, plan) {
    if (!plan) delete S.fav[id]; else S.fav[id] = plan;
    S.save();
  };
  S.get = id => S.fav[id] || null;
  S.dayList = function (day, plan) {
    return M.byDay[day].filter(s => !s.pause && (plan ? S.fav[s.id] === plan : !!S.fav[s.id]));
  };
  S.counts = function () {
    const c = { A: 0, B: 0, M: 0 };
    Object.values(S.fav).forEach(p => c[p]++);
    return c;
  };
  S.clear = function () { S.fav = {}; S.save(); };

  /* Teilen: kompakter Text */
  S.encode = function () {
    const g = { A: [], B: [], M: [] };
    for (const [id, p] of Object.entries(S.fav)) g[p].push(id);
    return ['A', 'B', 'M'].map(k => k + '=' + g[k].join(',')).join(';');
  };
  S.decode = function (txt) {
    const out = {};
    String(txt || '').split(';').forEach(part => {
      const [k, v] = part.split('=');
      if (!'ABM'.includes(k) || !v) return;
      v.split(',').forEach(id => { if (M.byId[id] && !M.byId[id].pause) out[id] = k; });
    });
    return out;
  };
  S.shareUrl = function () {
    const base = location.href.split('#')[0];
    return base + '#p=' + encodeURIComponent(S.encode());
  };
  S.exportJson = function () {
    return JSON.stringify({ app: 'wet26', version: 1, exported: new Date().toISOString(), fav: S.fav }, null, 2);
  };
  S.importObj = function (obj, mode) {
    const src = obj && obj.fav ? obj.fav : obj;
    const clean = {};
    for (const [id, p] of Object.entries(src || {})) if (M.byId[id] && !M.byId[id].pause && 'ABM'.includes(p)) clean[id] = p;
    if (mode === 'replace') S.fav = clean; else Object.assign(S.fav, clean);
    S.save();
    return Object.keys(clean).length;
  };
})();
