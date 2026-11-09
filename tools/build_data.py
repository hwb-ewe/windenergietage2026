#!/usr/bin/env python3
"""Erzeugt data/program.js aus data/src/*.txt (Programm von windenergietage.de/2026) und der Ortstabelle."""
import re, json, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'src')

# Pin-Koordinaten (u = Pixel im Standplan-Ausschnitt), Etage der Karte, Raumname laut Standplan
# Karten-Box in 200-dpi-Render: EG (107,653)-(1622,1914), UG (1672,653)-(1983,1148), OG (2050,653)-(3199,1910)
BOX = {'EG': (107, 653, 1622, 1914), 'UG': (1672, 653, 1983, 1148), 'OG': (2050, 653, 3199, 1910)}
def norm(floor, ux, uy):
    hx = 1704 + (ux - 1321) * 1.2425
    hy = 826 + (uy - 198) * 1.2425
    x0, y0, x1, y1 = BOX[floor]
    return round((hx - x0) / (x1 - x0), 4), round((hy - y0) / (y1 - y0), 4)

# floor, ux, uy, Raum, Ebene (Textangabe), Gruppe
V = {}
def v(key, label, room, level, floor, ux, uy, group, kind='forum'):
    nx, ny = norm(floor, ux, uy)
    V[key] = dict(id=key, label=label, room=room, level=level, floor=floor, u=dict(x=ux, y=uy), pin=dict(x=nx, y=ny), group=group, kind=kind)

og = {1:(2293,306),2:(2293,581),3:(2293,805),4:(2293,928),5:(1836,928),6:(1836,805),7:(1836,693),8:(1836,581),9:(1837,306)}
for n,(x,y) in og.items():
    v(f'F{n}', f'Forum {n}', f'Forum {n}', 'Obergeschoss', 'OG', x, y, 'OG')
v('F10','Forum 10','Restaurant','Erdgeschoss','EG',302,980,'EG')
v('F11','Forum 11','Restaurant','Erdgeschoss','EG',239,910,'EG')
v('F12','Forum 12','Restaurant','Erdgeschoss','EG',258,829,'EG')
v('F13','Forum 13','Española','Erdgeschoss','EG',454,692,'EG')
v('F14','Forum 14','Italiano','Erdgeschoss','EG',440,605,'EG')
v('F15','Forum 15','Franzose','Erdgeschoss','EG',435,513,'EG')
v('F16','Forum 16','Orangerie','Erdgeschoss','EG',474,345,'EG')
v('F17','Forum 17','Erdgeschoss (EG)','Erdgeschoss','EG',510,271,'EG')
v('F18','Forum 18','Erdgeschoss (EG)','Erdgeschoss','EG',510,203,'EG')
v('F19','Forum 19','Wohnzimmer','Erdgeschoss','EG',640,181,'EG')
v('F20','Forum 20','Pub','Erdgeschoss','EG',640,235,'EG')
v('F21','Forum 21','Wonderland','Erdgeschoss','EG',641,381,'EG')
v('F22','Forum 22','Bistro','Erdgeschoss','EG',738,527,'EG')
v('F23','Forum 23','Asia','Erdgeschoss','EG',701,609,'EG')
v('F24','Forum 24','Viktoriasaal','Erdgeschoss','EG',877,538,'EG')
v('F25','Forum 25','Charlestonsaal','Erdgeschoss','EG',874,817,'EG')
v('F26','Forum 26','Zirkuszelt','Erdgeschoss','EG',862,157,'Zelt')
v('F27A','Forum 27A','Zelt','Erdgeschoss','EG',941,205,'Zelt')
v('F27B','Forum 27B','Zelt','Erdgeschoss','EG',978,205,'Zelt')
v('F28A','Forum 28A','Zelt','Erdgeschoss','EG',941,145,'Zelt')
v('F28B','Forum 28B','Zelt','Erdgeschoss','EG',978,145,'Zelt')
v('F29','Forum 29','Autoscooter','Erdgeschoss','EG',761,197,'UG')
v('F30','Forum 30','Schwimmbad','Untergeschoss (laut Standplan)','EG',366,444,'UG')
v('F31','Forum 31','Wellness','Untergeschoss','UG',1321,198,'UG')
v('F32','Forum 32','Bowling','Untergeschoss','UG',1513,377,'UG')
v('F33','Forum 33','Themenhaus 447','Außengelände','EG',64,265,'Häuser')
v('F35','Forum 35','Themenhaus 452','Außengelände','EG',282,133,'Häuser')
v('F36','Forum 36','Themenhaus 483','Außengelände','EG',152,160,'Häuser')
v('F37A','Forum 37 Tech House','Haus 374 + 375 (Vestas)','Außengelände','EG',1030,149,'Häuser')
v('F37B','Forum 37 Commercial House','Haus 374 + 375 (Vestas)','Außengelände','EG',1079,149,'Häuser')
v('BC','Breakfast Club','BayWa Biergarten','Erdgeschoss','EG',1019,637,'Extras')
v('EA','E-Sports Arena','Valkensaal','Erdgeschoss','EG',848,447,'Extras')
haus = {301:(1020,381),303:(1020,333),304:(1020,286),305:(1020,239),347:(723,107),348:(819,108),374:(1030,149),375:(1079,149),376:(925,108),377:(900,108),400:(379,132),447:(64,265),451:(189,133),452:(282,133),481:(79,239),482:(101,213),483:(152,160),501:(123,187)}
for n,(x,y) in haus.items():
    v(f'H{n}', f'Themenhaus {n}', f'Themenhaus {n}', 'Außengelände', 'EG', x, y, 'Häuser', 'haus')
for n in (1,2,3):
    v(f'T{n}', f'Thementisch {n}', 'Thementische (Restaurant)', 'Erdgeschoss', 'EG', 302, 980, 'Tische', 'tisch')

PAUSE = re.compile(r'^(pause\b|kaffeepause|kurze kaffeepause|mittagspause|coffee break|diskussion$|fragen\?$|raubtierfütterung|es schreit nach kaffee|pause &|pause \(|gelegenheit für bilateralen|ausklang des vormittags$)', re.I)

def parse_links(s):
    out = []
    for tok in s.split():
        if '=' in tok and not tok.startswith('http'):
            lab, url = tok.split('=', 1)
            out.append(dict(t=lab.replace('-', ' '), u=url))
        elif tok.startswith('http'):
            out.append(dict(t=re.sub(r'^https?://(www\.)?', '', tok).split('/')[0], u=tok))
    return out

days, blocks, sessions = [], [], []
used_ids = set()
for fn in ('di.txt', 'mi.txt', 'do.txt'):
    day = None
    block = None
    for ln, line in enumerate(open(os.path.join(SRC, fn), encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip():
            continue
        if line.startswith('@day'):
            _, did, date, name = line.split(' ', 3)
            day = dict(id=did, date=date, name=name)
            days.append(day)
            continue
        if line.startswith('# '):
            parts = [p.strip() for p in line[2:].split('::')]
            parts += [''] * (5 - len(parts))
            key, short, title, links, note = parts[:5]
            if key not in V:
                sys.exit(f'{fn}:{ln}: unbekannter Ort {key}')
            block = dict(id=f'{day["id"]}.{key}.{len([b for b in blocks if b["day"]==day["id"] and b["v"]==key])+1}', day=day['id'], v=key, short=short, title=title, links=parse_links(links), note=note)
            blocks.append(block)
            continue
        m = re.match(r'(\d\d):(\d\d)-(\d\d):(\d\d) :: (.*)$', line)
        if not m:
            sys.exit(f'{fn}:{ln}: Zeile nicht lesbar: {line[:60]}')
        h1, m1, h2, m2, rest = m.groups()
        f = [p.strip() for p in rest.split(' :: ')]
        title = f[0]; sp = f[1] if len(f) > 1 else ''
        s = int(h1)*60+int(m1); e = int(h2)*60+int(m2)
        base = f'{day["id"]}.{block["v"]}.{h1}{m1}'
        sid = base; i = 2
        while sid in used_ids:
            sid = f'{base}{chr(96+i)}'; i += 1
        used_ids.add(sid)
        sessions.append(dict(id=sid, day=day['id'], v=block['v'], b=block['id'], s=s, e=e, t=title, sp=sp, pause=bool(PAUSE.search(title.strip()))))

prog = dict(
    title='34. Windenergietage 2026', place='Linstow', source='https://windenergietage.de/2026/', tz='Europe/Berlin',
    days=days, venues=V, blocks=blocks, sessions=sessions,
    nav=[
        ('Startseite / Programm','https://windenergietage.de/2026/'),('Anmeldungen','https://windenergietage.de/2026/anmeldungen/'),
        ('Standplan / Aussteller','https://windenergietage.de/2026/standplan/'),('Teilnehmerliste','https://windenergietage.de/2026/teilnehmerliste/'),
        ('Übernachtung','https://windenergietage.de/2026/hotelliste/'),('Anreise','https://windenergietage.de/2026/anreise/'),
        ('Kostenfreier Transfer','https://windenergietage.de/2026/kostenfreier-transfer/'),('30 Minuten…','https://windenergietage.de/2026/30-minuten/'),
        ('Unterstützer','https://windenergietage.de/2026/unterstuetzerkatalog/'),('DIES DAS DINGS','https://windenergietage.de/2026/dies-das-dings/'),
        ('Downloads','https://windenergietage.de/2026/downloads/'),('Kontakt','https://windenergietage.de/2026/kontakt/'),('Archiv','https://windenergietage.de/2026/archiv/'),
        ('Spreewindspiegel 2026 (PDF)','https://windenergietage.de/2026/wp-content/uploads/sites/11/2026/11/Spreewindspiegel-2026.pdf'),
        ('Teilnahme + Zimmer Seehotel Schloss Klink (PDF)','https://windenergietage.de/2026/wp-content/uploads/sites/11/2026/10/261029-Seehotel-Schloss-Klink-2026.pdf'),
        ('Anmeldung','https://windenergietage.de/2026/anmeldung/'),
    ])
prog['nav'] = [dict(t=a, u=b) for a, b in prog['nav']]
out = os.path.join(ROOT, 'data', 'program.js')
with open(out, 'w', encoding='utf-8') as fh:
    fh.write('/* automatisch erzeugt von tools/build_data.py – nicht von Hand ändern */\nwindow.PROGRAM = ')
    json.dump(prog, fh, ensure_ascii=False, separators=(',', ':'))
    fh.write(';\n')
real = [s for s in sessions if not s['pause']]
print('Sessions', len(sessions), 'davon wählbar', len(real), 'Blöcke', len(blocks), 'Größe', os.path.getsize(out)//1024, 'KB')
for d in days:
    ss = [s for s in sessions if s['day']==d['id']]
    print(d['id'], len(ss), min(s['s'] for s in ss)//60, max(s['e'] for s in ss)//60)
