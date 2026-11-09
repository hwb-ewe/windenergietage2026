# Windenergietage 2026 – Programmplaner (PWA)

Statische Web-App (HTML/CSS/JS, kein Backend) für das Programm der 34. Windenergietage, Linstow, 10.–12.11.2026.
Quelle: https://windenergietage.de/2026/ (Programmstand 9.11.2026, von Hand übernommen).

## Veröffentlichen auf GitHub Pages
1. Neues Repository anlegen, den **Inhalt dieses Ordners** in den Root hochladen (index.html liegt im Root).
2. Settings → Pages → Branch `main`, Ordner `/ (root)`.
3. Aufruf: `https://<user>.github.io/<repo>/` – alle Pfade sind relativ, Unterpfad funktioniert.
4. Offline/„Zum Home-Bildschirm“: in Safari Teilen → „Zum Home-Bildschirm“.

## Aufbau
- `data/src/*.txt` – Programm (Quelle der Wahrheit), `tools/build_data.py` erzeugt daraus `data/program.js`
  (`python3 tools/build_data.py`). Nach Programmänderungen neu erzeugen und in `sw.js` die Version `VER` erhöhen.
- `js/config.js` – Annahmen für Wegzeiten (Gehtempo, „weit“ ab 3 Min., Pausen bis 10 Min. werden als „knapp“ geprüft).
- Favoriten liegen nur im Browser (localStorage, Schlüssel `wet26.v1`); Teilen per Link (`#p=…`), Sicherung als JSON, Kalender als .ics.

## Logik
- Plan A, Plan B und Merkliste werden je für sich auf Überschneidungen geprüft (rot). Zwischen A und B keine Warnung.
- Direktanschluss an anderem Ort (0 Min.) bzw. knapper Wechsel: orange; Hinweis „weit auseinander“ bei geschätzten ≥ 3 Min. Fußweg.
- Wegzeiten sind Schätzungen aus den Pin-Positionen auf dem Standplan.
