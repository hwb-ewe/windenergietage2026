/* Kalender-Export (.ics) im Europe/Berlin-Zeitformat */
(function () {
  'use strict';
  const M = window.Model, S = window.Store;

  const esc = t => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function fold(line) {
    const out = []; let cur = '', bytes = 0;
    for (const ch of line) {
      const b = new TextEncoder().encode(ch).length;
      if (bytes + b > 73) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; } else { cur += ch; bytes += b; }
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function dt(dateStr, min) {
    let d = new Date(dateStr + 'T00:00:00Z');
    if (min >= 1440) { d = new Date(d.getTime() + 86400000); min -= 1440; }
    const y = d.getUTCFullYear(), mo = String(d.getUTCMonth() + 1).padStart(2, '0'), da = String(d.getUTCDate()).padStart(2, '0');
    return y + mo + da + 'T' + String(Math.floor(min / 60)).padStart(2, '0') + String(min % 60).padStart(2, '0') + '00';
  }

  window.Ics = {
    /* plans: z. B. ['A'] | ['B'] | ['A','B'] | ['A','B','M'] */
    build(plans) {
      const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Windenergietage 2026 Planer//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'X-WR-CALNAME:Windenergietage 2026', 'X-WR-TIMEZONE:Europe/Berlin',
        'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
        'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
        'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
        'END:VTIMEZONE'];
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      let n = 0;
      const list = M.sessions.filter(s => !s.pause && plans.includes(S.fav[s.id]))
        .sort((a, b) => M.dayInfo[a.day].date.localeCompare(M.dayInfo[b.day].date) || a.s - b.s);
      for (const s of list) {
        const v = M.venues[s.v], b = M.blocks[s.b], plan = S.fav[s.id];
        const date = M.dayInfo[s.day].date;
        const prefix = plan === 'B' ? '[Plan B] ' : plan === 'M' ? '[Merkliste] ' : '';
        const desc = [b.title, s.sp, plan === 'A' ? 'Plan A' : plan === 'B' ? 'Plan B' : 'Merkliste', 'Programm: ' + (b.links[0] ? b.links[0].u : window.PROGRAM.source)].filter(Boolean).join('\n');
        lines.push('BEGIN:VEVENT', 'UID:' + s.id + '@wet26.planer', 'DTSTAMP:' + stamp,
          'DTSTART;TZID=Europe/Berlin:' + dt(date, s.s), 'DTEND;TZID=Europe/Berlin:' + dt(date, s.e),
          fold('SUMMARY:' + esc(prefix + s.t)), fold('LOCATION:' + esc(v.label + ' – ' + v.room + ', Windenergietage Linstow')),
          fold('DESCRIPTION:' + esc(desc)), 'URL:' + window.PROGRAM.source, 'CATEGORIES:' + (plan === 'B' ? 'Plan B' : plan === 'A' ? 'Plan A' : 'Merkliste'));
        const al = S.set.alarm | 0;
        if (al > 0) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(s.t), 'TRIGGER:-PT' + al + 'M', 'END:VALARM');
        lines.push('END:VEVENT');
        n++;
      }
      lines.push('END:VCALENDAR');
      return { text: lines.map(l => (l.length > 74 && !l.startsWith(' ') && !l.includes('\r\n') ? fold(l) : l)).join('\r\n') + '\r\n', count: n };
    }
  };
})();
