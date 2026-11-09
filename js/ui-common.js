/* Gemeinsame UI-Helfer: Icons, Escape, Toast, Bottom-Sheet */
(function () {
  'use strict';
  const U = (window.UI = {});

  U.esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.$ = (s, r) => (r || document).querySelector(s);
  U.$$ = (s, r) => [...(r || document).querySelectorAll(s)];

  const P = {
    star: '<path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/>',
    grid: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    plan: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L6.5 5M3.5 12l1.2 1.2L6.5 11M3.5 18l1.2 1.2L6.5 17"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 3 2v4M12 15l-1-5 3-1 2 4M9 11l-3 2"/>',
    pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    cols: '<rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 10 18.7l1-1"/>'
  };
  U.ic = (n, cls) => `<svg class="i ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
  U.icFill = n => `<svg class="i f" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

  let tt;
  U.toast = function (msg) {
    const el = U.$('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(tt);
    tt = setTimeout(() => el.classList.remove('show'), 2600);
  };

  /* Bottom-Sheet */
  const root = () => U.$('#sheet-root');
  let onCloseCb = null;
  U.sheet = {
    show(html, bind) {
      const r = root();
      const prev = U.$('.sheet', r);
      const st = prev ? prev.scrollTop : 0;
      const wasOpen = r.classList.contains('open');
      r.innerHTML = `<div class="backdrop" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
      const sh = U.$('.sheet', r);
      if (wasOpen) { sh.style.transition = 'none'; r.classList.add('open'); sh.scrollTop = st; requestAnimationFrame(() => (sh.style.transition = '')); }
      else requestAnimationFrame(() => requestAnimationFrame(() => r.classList.add('open')));
      if (bind) bind(sh);
    },
    close() {
      const r = root();
      r.classList.remove('open');
      setTimeout(() => { if (!r.classList.contains('open')) r.innerHTML = ''; }, 280);
      if (onCloseCb) { const f = onCloseCb; onCloseCb = null; f(); }
    },
    isOpen: () => root().classList.contains('open')
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && U.sheet.isOpen()) U.sheet.close(); });
})();
