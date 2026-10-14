# Daily Brief

Persönliche Nachrichtenseite: dreimal täglich (07:00, 12:00, 18:00 Uhr deutsche Zeit) eine kompakte Ausgabe zu Wirtschaft, Krypto, Iran, USA und Nahem Osten. Jede Aussage mit Quelle, Gerüchte gekennzeichnet, mit Vorlesefunktion.

## Aufbau

- `index.html`, `assets/`: statische Seite ohne Build-Schritt (HTML, CSS, JavaScript). Markdown wird im Browser mit [marked](https://github.com/markedjs/marked) gerendert und mit [DOMPurify](https://github.com/cure53/DOMPurify) bereinigt (beide in `assets/vendor/`).
- `articles/*.md`: eine Datei pro Ausgabe, mit Frontmatter (Titel, Labels, Quellen).
- `articles/index.json`: wird von `scripts/build_index.py` erzeugt und prüft dabei alle Artikel.
- `REDAKTION.md`: Regeln und Format für neue Ausgaben.

## Lokal ansehen

```bash
python3 scripts/build_index.py
python3 -m http.server 8000
# http://localhost:8000
```

## Vorlesen

Nutzt die Web Speech API des Browsers: Start, Pause, Stopp, Geschwindigkeit 0,5× bis 2×, Stimmenwahl und optional automatisches Vorlesen beim Öffnen eines Artikels. Einstellungen werden im Browser gespeichert.

Keine Anlageberatung.
