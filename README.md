# Daily Brief

Persönliche Nachrichtenseite für Amir. Dreimal täglich ausführlich informiert: Wirtschaft, Märkte, Krypto, Iran, USA, Naher Osten, KI und Tech. Zielzeiten: 07:00, 12:00 und 18:00 Uhr in Europe/Berlin.

## Funktionen

- Tagesübersicht mit drei Ausgaben, Veröffentlichungszeiten und neuester Ausgabe.
- Archiv in 20er-Schritten; Volltextsuche mit Ausschnitten, Thema, Ausgabe, Zeitraum, Lesezeichen und Ungelesen-Filter. Suchansichten bleiben als URL teilbar.
- Inhaltsverzeichnis, drei Schriftgrößen, Lesefortschritt und aufklappbare Originalquellen.
- Lesezeichen, manuelle Gelesen-Markierungen, letzte Lese- und Hörposition sowie bevorzugte Themen.
- Durchsuchbare Lernbibliothek aus den vorhandenen Lernkästen mit Rückverweis zur Ausgabe.
- JSON-Sicherung und validierter Import mit Vorschau und Rückgängig-Funktion.
- Web Speech API mit Abschnittswechsel, Stimmenwahl, Geschwindigkeit, optionalem Mitscrollen und automatischem Start.
- Installierbare Web-App; Oberfläche, Metadaten, Lernbibliothek und die letzten zehn geöffneten Ausgaben offline. Der Volltextindex wird bei erster Suche geladen und dann ebenfalls offline gespeichert.
- Lokal bereitgestellte Schriften mit SIL-OFL-Lizenzen.

Persönliche Daten bleiben browserlokal. Beim Löschen der Browserdaten gehen sie verloren; für Gerätewechsel JSON-Export und Import verwenden. Stimmen können geräte- oder netzwerkabhängig sein. Die Inhalte sind keine Anlageberatung.

## Lokal starten

Voraussetzungen: Python 3.11+ und Node.js 24 für die Tests.

~~~bash
python -m pip install -r requirements.txt
python scripts/build_site.py
python -m http.server 8000 --directory _site
~~~

Dann http://localhost:8000 öffnen. Für Offline-Funktionen sind localhost oder HTTPS nötig. Eine neue Offline-Version wird erst nach „Jetzt neu laden“ aktiviert. Bei fehlgeschlagener Installation bleibt die vorige Version erhalten.

## Qualität prüfen

~~~bash
python scripts/check_legacy.py
python scripts/build_index.py --check
python -m unittest discover -s tests -p 'test_*.py' -v
npm test
~~~

Die Node-Tests benötigen keine npm-Pakete. Die Python-Tests verwenden temporäre Testartikel, nicht den echten Bestand. Der Offline-Cache wird unter einem GitHub-Pages-Projektpfad getestet.

Für Quellen-Erreichbarkeit optional:

~~~bash
python scripts/check_links.py --all
~~~

Das ist eine Netzwerkprüfung, keine inhaltliche Faktenprüfung. Nicht erreichbare Quellen erzeugen Hinweise und verhindern die Veröffentlichung nicht.

## Redaktion und Daten

[REDAKTION.md](REDAKTION.md) beschreibt Recherche, Format und Veröffentlichung. Neue und bearbeitete Ausgaben müssen 700–1.200 Wörter, drei Kernaussagen, drei bis vier nummerierte Hauptthemen, einen Lernkasten, eine Reflexionsfrage und einen Abschnitt „Neu seit der letzten Ausgabe“ enthalten. Dieser verlinkt die chronologisch vorherige Ausgabe.

Die 59 ursprünglichen Ausgaben bleiben unverändert. Ihre Inhalts-Hashes in scripts/legacy_articles.json erlauben redaktionelle Abweichungen als Warnung. Der eingefrorene Bestand wird gegen Git-Commit 668a9c01198101960992caf679d9a42e9cbe3079 geprüft und darf nicht erweitert werden. Jede Änderung an einem alten Artikel aktiviert die aktuellen Regeln.

Optionale Korrekturen im Frontmatter:

~~~yaml
updated_at: "2026-11-01T09:15:00+01:00"
correction_note: "Die Zahl wurde anhand der Originalquelle korrigiert."
~~~

Der Build erzeugt deterministisch:

- articles/index.json: Ausgaben, Quellen, Vorgängerverweis und optionale Korrektur.
- articles/search-index.json: separater Volltextindex.
- articles/learning.json: extrahierte Lernkästen.
- precache.json und die Versionsmarkierung in sw.js: zusammengehörige Offline-Oberfläche.
- _site/: veröffentlichbare Dateien. Redaktion, Tests und Git-Daten werden nicht mit ausgeliefert.

## GitHub Pages veröffentlichen

Der Workflow .github/workflows/publish.yml führt bei Pull Requests die Prüfungen aus. Auf main wird nach erfolgreichen Prüfungen ausschließlich _site veröffentlicht.

**Einmaliger Wechsel beim Release:** Unter Repository Settings → Pages → Build and deployment → Source **GitHub Actions** wählen. Der bisherige Modus „Deploy from a branch“ veröffentlicht direkt aus main und sichert die Veröffentlichung nicht durch den neuen Prüfjob ab. Den Wechsel zusammen mit der Übernahme des Pull Requests vornehmen.

Die bestehende externe Recherche-Routine liest weiter REDAKTION.md und veröffentlicht zu ihren bisherigen Zeiten. Es wird kein zusätzlicher Recherche-Zeitplan angelegt. Sie muss die neuen Redaktionsregeln erfüllen; sonst verweigern lokaler Build und CI die neue Veröffentlichung. Die letzte erfolgreiche Live-Ausgabe bleibt verfügbar.

[Browser-Prüfplan und Grenzen](docs/QA.md)
