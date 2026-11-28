# Issue: Browserbasiertes Snake-Spiel implementieren

## Ziel

Implementiere ein kleines, eigenständig spielbares Snake-Spiel für den Browser.
Die Lösung muss ohne Backend funktionieren, deterministisches Spielverhalten
ermöglichen und eine klare Trennung zwischen Kernlogik und Darstellung
verwenden.

## User Stories und Verhalten

- Als Spieler kann ich ein neues Spiel starten und das Spielfeld sofort sehen.
- Die Schlange bewegt sich in diskreten Zeitschritten mit genau einer
  gültigen Bewegungsrichtung.
- Als Spieler lenke ich die Schlange mit Tastatur und, falls sinnvoll
  angeboten, mit zugänglichen Touch-Bedienelementen.
- Wenn die Schlange Nahrung erreicht, wächst sie und der Punktestand erhöht
  sich.
- Nahrung erscheint deterministisch ausgewählt nur auf einer freien Zelle.
- Bei Wand- oder Selbstkollision endet das Spiel eindeutig mit Game Over.
- Nach Game Over kann ich das Spiel ohne Seitenneuladung neu starten.
- Die Punktanzeige bleibt während Start, Spiel, Game Over und Neustart
  nachvollziehbar.

## Steuerung

- Unterstütze die Pfeiltasten und, wenn das UI das anbietet, `WASD`.
- Eine einzelne Eingabe wählt höchstens einen Richtungswechsel pro Tick.
- Die unmittelbar entgegengesetzte Richtung wird verworfen.
- Wiederholte oder diagonale Eingaben führen nie zu zwei Zellenbewegungen pro
  Tick.
- Mobile oder Touch-Unterstützung ist optional; wenn sie angeboten wird, muss
  sie dieselben Eingaberegeln und annehmbare Trefferflächen verwenden.

## Punktestand

- Beginne jeden Lauf mit `0` Punkten.
- Eine aufgenommene Nahrung erhöht den Punktestand um einen festen,
  dokumentierten Wert.
- Essen und Punktestand werden aus derselben Zustandsänderung aktualisiert.
- Der angezeigte Punktestand muss mit dem Kernzustand übereinstimmen.

## Kollision, Game Over und Neustart

- Berührt der neue Schlangenkopf eine Wand, endet der Lauf sofort.
- Berührt der Kopf einen noch belegten Körperteil, endet der Lauf sofort.
- Nach Game Over stoppen weitere Bewegungsaktionen; die Anzeige nennt den
  Status eindeutig.
- Restart setzt Schlange, Richtung, Nahrung, Punktestand und Laufstatus auf den
  definierten Startzustand zurück.
- Ein Mehrfach-Klick auf Restart darf nicht mehrere Timer oder Spielschleifen
  erzeugen.

## Deterministische Kernlogik

- Implementiere die Kernlogik als reine oder injizierbare Funktion, unabhängig
  von DOM, Zeit und globalem Zufall.
- Verwende einen festgelegten Zufalls-Seed oder injiziere den Zufallsgenerator
  für Tests.
- Der gleiche Startzustand und dieselbe Abfolge von Eingaben/Ticks ergeben
  immer denselben Endzustand.
- Trenne Tick, Richtungsannahme, Nahrungsplatzierung, Kollisionsprüfung,
  Punktestand und Restart als klar testbare Schritte oder Funktionen.

## UI, Responsive Design und Barrierefreiheit

- Das Spielfeld bleibt auf Desktop- und Mobilgrößen ohne horizontales
  Überlaufen nutzbar.
- Fokus, Tastaturbedienung und sichtbare Steuerungshinweise sind vorhanden.
- Statusänderungen wie Game Over und Punktestand werden auch für
  Screenreader wahrnehmbar ausgegeben.
- Relevante Farben haben ausreichenden Kontrast; Inhalt darf nicht allein über
  Farbe codiert sein.
- Keine automatische Ton-, Bewegungs- oder Fullscreen-Wiedergabe.

## Technische Rahmenbedingungen

- Verwende die im Consumer-Repository etablierte Frontend-/Build-Struktur.
  Es gibt keine neue Backend-Abhängigkeit.
- Ergänze minimale, verständliche Start- und Testkommandos in der README.
- Halte Secrets, externe Services und produktionsspezifische Konfiguration aus
  der Implementierung heraus.
- Führe abhängige Zustandsänderungen atomar pro Tick aus.

## Akzeptanzkriterien

- Das Spiel ist lokal startbar und im Browser spielbar.
- Startzustand und Neustart sind identisch und reproduzierbar.
- Pfeiltastenfunktion, optional `WASD`, Wachstum, Punktestand, Kollision,
  Game Over und Restart funktionieren gemäß den Regeln.
- Direkte Umkehr wird blockiert; pro Tick erfolgt maximal ein Schritt.
- Die Core-Logik ist ohne Browser und Zeitabhängigkeit testbar.
- Dieselbe Seed-/Aktionsfolge liefert bitgleich denselben Zustand.
- Responsive UI und definierte Zugriffsmöglichkeiten sind nachvollziehbar
  geprüft.
- Build, Check und automatisierte Tests laufen ohne Fehler.
- README dokumentiert Start, Steuerung, Test und technische Grenzen.

## Tests

Mindestens automatisiert nachweisen:

- deterministischer Startzustand bei festem Seed;
- Bewegung in jede Richtung ohne diagonale Schritte;
- Ablehnung der direkten Gegenrichtung;
- Platzierung von Nahrung nur auf freien Zellen;
- Wachstum und Score-Erhöhung nach Aufnahme;
- Wandkollision und Selbstkollision;
- Game Over stoppt weitere Ticks;
- Restart stellt den Startzustand wieder her;
- identische Aktionsfolge erzeugt identischen Zustand;
- keine doppelte Spielschleife nach wiederholtem Restart.

Ergänzend manuell in einem Desktop-Browser und einer schmalen Viewport-Größe
prüfen: sichtbares Raster, Bedienung, Fokus, Game Over, Neustart, Überlauf,
Konsole und Netzwerkfehler.

## Out of scope

- Multiplayer, Ranglisten, Accounts, Persistenz oder Backend;
- KI-Spieler, Levelsystem, Power-ups und komplexe Animationen;
- Audioeffekte und externe Telemetrie;
- automatisches Markieren eines PR als ready, Approval oder Merge;
- Berechtigungs-, Secret- oder Project-/Issue-Managementänderungen außerhalb
  der für die Implementierung nötigen Issue-Referenz.
