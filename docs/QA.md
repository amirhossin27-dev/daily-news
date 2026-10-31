# Prüfung und Rollout

## Automatisiert

- Redaktion: gültige Daten und Uhrzeiten, getypte Metadaten und Quellen, Zitate, Längen- und Strukturregeln, Korrekturen, Vorgängerverweise und unveränderter historischer Bestand.
- Daten: deterministische Indizes, leeres Archiv, Extraktion mehrzeiliger Lernkästen, erneute strikte Prüfung nach Änderung eines historischen Artikels.
- Anwendung: alte Artikellinks, beschädigte URLs, kombinierte Volltextfilter, Berlin-Tagesgrenzen und beide Zeitumstellungen, Fortschrittsgrenzen.
- Persönliche Daten: Neustart, Export/Import, ungültiger Import ohne Teiländerung, blockierter Speicher und alte Einstellungen.
- Vorlesen: Abschnittswechsel, Pause/Fortsetzen, ignorierte veraltete Audio-Rückrufe und fehlende Browser-Unterstützung.
- Offline: Projekt-Unterpfad, gespeicherte und fehlende Artikel, zehn zuletzt geöffnete Ausgaben, erneute Nutzung älterer Ausgaben, frische Indizes, Netzwerkfehler, echte 404 und Versionsisolation.

## Browser-Abnahme

Getestete Kernabläufe in der lokalen Vorschau:

- Tagesübersicht und bestehender Link zur Abendausgabe vom 31.10.2026.
- Quellen-Dialog mit Fokus auf Schließen, Rückkehr zum Quellenknopf und Zugriff zur vollständigen Quellenliste.
- Schriftgröße 130 %, Lesezeichen und Abschnittswechsel im Player.
- Volltextsuche nach RealClearPolling mit genau einem Treffer aus dem Fließtext; Kombination mit Iran und Abendausgabe.
- Lernbibliothek mit 56 vorhandenen Lernkästen.
- Schriftgröße, bevorzugtes Thema und Farbschema nach einem Reload wiederhergestellt.
- Darstellung bei 390 und 320 CSS-Pixeln; kein horizontaler Seitenüberlauf.
- Archiv von 20 auf 40 Ausgaben erweitert, älteren Artikel geöffnet und anschließend 40 Ausgaben sowie die Scrollposition wiederhergestellt.
- Gespeicherten Artikel einschließlich aller drei Quellen nach Stoppen des lokalen HTTP-Servers neu geladen. Dies prüft den Netzwerkausfall, nicht den Flugmodus des Betriebssystems.
- Bei 320 Pixeln sind alle Player-Schaltflächen einschließlich Stopp sichtbar; kein horizontaler Überlauf.
- Eine wartende Offline-Version wurde im Aktualisierungshinweis angezeigt.

Zusätzlich vor dem produktiven Release auf den tatsächlich verwendeten Geräten prüfen:

1. 200 % Browserzoom, Tastaturbedienung, Fokus und Touch mit geöffnetem Player sowie Quellendialog.
2. Suchfilter und Scrollposition auch im tatsächlich verwendeten mobilen Browser prüfen.
3. Lese- und Hörposition nach Tab-Neustart; Korrekturtexte und Meldung bei nicht gespeicherter Offline-Ausgabe.
4. JSON-Export und Import auf einem zweiten Gerät; Rückgängig-Funktion nach Import.
5. Installieren und Flugmodus auf Android/iOS/Desktop, zehn gespeicherte Ausgaben lesen, dann Verbindung wiederherstellen.
6. Verfügbare deutsche Stimmen wirklich anhören, Pause/Fortsetzen und Abschnittswechsel auf dem jeweiligen Gerät prüfen. Die automatisierten Tests ersetzen keinen Test der betriebssystemspezifischen Stimmen.
7. Eine neue Web-Version bauen: wartende Version anzeigen, bewusst aktualisieren, danach neue Oberfläche und neue Ausgaben prüfen.

## Release

Die Änderungen liegen zunächst auf einem Entwicklungsbranch. Vor der Übernahme müssen die CI-Prüfungen grün sein. Beim Release GitHub Pages von branchbasierter Veröffentlichung auf GitHub Actions umstellen; erst dieser Schritt aktiviert die Auslieferung aus dem geprüften Build. Die bisherige öffentliche URL bleibt bestehen.

Die historische Redaktion wird nicht automatisch umgeschrieben. Für neue Nachrichten muss die bestehende externe Erstellungsroutine die aktualisierten Regeln lesen und einhalten. Die Quellen-Erreichbarkeitsprüfung ist bewusst keine automatische inhaltliche Freigabe.
