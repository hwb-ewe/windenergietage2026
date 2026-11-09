/* Einstellungen für Wegzeit-Schätzung und Darstellung. Alle Werte sind grobe Annahmen und können angepasst werden. */
window.CFG = {
  // Karten-Einheit (Pixel im Standplan-Ausschnitt) -> Meter. Der gesamte Erdgeschoss-Plan ist ca. 1200 Einheiten breit.
  metersPerUnit: 0.25,
  // Gehgeschwindigkeit in Metern pro Minute
  speeds: { slow: 55, normal: 75, fast: 95 },
  // Aufzug-/Treppenknoten je Etage in Karten-Einheiten (Übergang zwischen den Etagen)
  stairs: { EG: { x: 575, y: 250 }, OG: { x: 2065, y: 340 }, UG: { x: 1424, y: 200 } },
  floorChangeMin: 1.0,     // Zuschlag für Treppe/Aufzug in Minuten
  outdoorFactor: 1.3,      // Umweg-Faktor für Wege im Außengelände (Themenhäuser)
  doorMin: 0.5,            // Zeit für Ein-/Ausgang aus dem Raum
  farMin: 3.0,             // ab dieser Wegzeit gelten Orte als „weit auseinander“
  tightLookMin: 10,        // Pausen bis zu dieser Länge werden auf „knapp“ geprüft
  defaults: { ppm: 2, colw: 132, speed: 'normal', showPauses: false, alarm: 10, hideEmptyCols: true }
};
