/* Kartenansicht: Etagenplan mit Zoom/Verschieben (Touch, Maus, Rad) und Pins */
(function () {
  'use strict';
  const SIZE = { EG: [2273, 1892], OG: [1723, 1886], UG: [466, 743] };
  const M = window.Model, U = window.UI;

  function mount(el, o) {
    const [W, H] = SIZE[o.floor];
    el.innerHTML = '';
    const stage = document.createElement('div');
    stage.className = 'mapstage';
    stage.style.width = W + 'px'; stage.style.height = H + 'px';
    stage.innerHTML = `<img src="img/${o.floor.toLowerCase()}.webp" width="${W}" height="${H}" alt="Standplan ${o.floor}" draggable="false">`;
    let svg = '';
    if (o.line) {
      const a = M.venues[o.line[0]].pin, b = M.venues[o.line[1]].pin;
      svg = `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;pointer-events:none"><line x1="${a.x * W}" y1="${a.y * H}" x2="${b.x * W}" y2="${b.y * H}" stroke="#ff3b30" stroke-width="6" stroke-dasharray="14 10" stroke-linecap="round"/></svg>`;
    }
    stage.insertAdjacentHTML('beforeend', svg);
    o.pins.forEach(p => {
      const d = document.createElement('div');
      d.className = 'pin ' + p.cls;
      d.style.left = p.v.pin.x * W + 'px'; d.style.top = p.v.pin.y * H + 'px';
      d.innerHTML = `<span class="bub">${U.esc(o.labelOf(p.v))}</span>`;
      d.dataset.v = p.v.id;
      stage.appendChild(d);
    });
    el.appendChild(stage);
    const ctl = document.createElement('div');
    ctl.className = 'mapctl';
    ctl.innerHTML = '<button data-z="1" aria-label="Vergrößern">+</button><button data-z="-1" aria-label="Verkleinern">−</button><button data-z="0" aria-label="Einpassen">⤢</button>';
    el.appendChild(ctl);
    const lg = document.createElement('div');
    lg.className = 'maplegend';
    lg.innerHTML = '<i style="background:var(--blue)"></i>A <i style="background:var(--purple)"></i>B <i style="background:var(--gold)"></i>Merkliste <i style="background:var(--red)"></i>Ziel';
    el.appendChild(lg);

    let k = 1, tx = 0, ty = 0, minK = 0.2;
    const apply = () => {
      stage.style.transform = `translate(${tx}px,${ty}px) scale(${k})`;
      stage.style.setProperty('--k', k);
    };
    const clamp = () => {
      const w = el.clientWidth, h = el.clientHeight, sw = W * k, sh = H * k;
      tx = sw <= w ? (w - sw) / 2 : Math.min(0, Math.max(w - sw, tx));
      ty = sh <= h ? (h - sh) / 2 : Math.min(0, Math.max(h - sh, ty));
    };
    const zoomAt = (nk, cx, cy) => {
      nk = Math.min(2.5, Math.max(minK, nk));
      tx = cx - (cx - tx) * (nk / k); ty = cy - (cy - ty) * (nk / k); k = nk; clamp(); apply();
    };
    const fit = () => {
      const w = el.clientWidth || 360, h = el.clientHeight || 500;
      minK = Math.min(w / W, h / H); k = minK; tx = ty = 0;
      if (o.focus && o.focus.length) {
        // auf Fokus-Pins zoomen
        const ps = o.focus.map(id => M.venues[id].pin);
        const xs = ps.map(p => p.x * W), ys = ps.map(p => p.y * H);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const bw = Math.max(x1 - x0, 300) + 300, bh = Math.max(y1 - y0, 300) + 300;
        k = Math.min(1.6, Math.max(minK, Math.min(w / bw, h / bh)));
        tx = w / 2 - ((x0 + x1) / 2) * k; ty = h / 2 - ((y0 + y1) / 2) * k;
      }
      clamp(); apply();
    };
    const rm = () => { minK = Math.min(el.clientWidth / W, el.clientHeight / H); };
    fit();
    requestAnimationFrame(fit);

    ctl.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const z = +b.dataset.z, cx = el.clientWidth / 2, cy = el.clientHeight / 2;
      if (z === 0) fit(); else zoomAt(k * (z > 0 ? 1.4 : 1 / 1.4), cx, cy);
    });
    el.addEventListener('wheel', e => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(k * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });

    const ptr = new Map(); let last = null, moved = false, startPos = null;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.mapctl')) return;
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptr.size === 1) { moved = false; startPos = { x: e.clientX, y: e.clientY }; }
      last = null;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', e => {
      if (!ptr.has(e.pointerId)) return;
      const p = ptr.get(e.pointerId), px = p.x, py = p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptr.size === 1) {
        if (Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y) > 6) moved = true;
        if (moved) { tx += e.clientX - px; ty += e.clientY - py; clamp(); apply(); }
      } else if (ptr.size === 2) {
        moved = true;
        const [a, b] = [...ptr.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const r = el.getBoundingClientRect();
        if (last) { zoomAt(k * d / last.d, cx - r.left, cy - r.top); tx += cx - last.cx; ty += cy - last.cy; clamp(); apply(); }
        last = { d, cx, cy };
      }
    });
    const up = e => {
      const wasTap = ptr.size === 1 && !moved;
      ptr.delete(e.pointerId); last = null;
      if (wasTap) {
        const pin = e.target.closest('.pin');
        if (pin && o.onPin) o.onPin(pin.dataset.v);
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', e => { ptr.delete(e.pointerId); last = null; });
    const ro = window.ResizeObserver ? new ResizeObserver(() => { rm(); clamp(); apply(); }) : null;
    if (ro) ro.observe(el);
    return { destroy() { if (ro) ro.disconnect(); } };
  }
  window.MapView = { mount };
})();
