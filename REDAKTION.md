# Redaktionsleitfaden für den Daily Brief

Dieser Leitfaden gilt für jede Ausgabe. Die täglichen Routinen lesen ihn vor dem Schreiben.

## Leser

Amir: Wirtschaftsingenieur (RWTH), IT-Projektmanager bei BASF (Intranet-Portale, Azure-Migrationen), baut nebenbei ein KI-gestütztes Geschäft auf (Automatisierung, Micro-SaaS). Interessiert an Wirtschaft und Märkten, Krypto (Bitcoin, Ethereum, Hedera), Iran, USA und Nahem Osten, außerdem KI und Tech. Er denkt analytisch, mag Zahlen und Logik und will lernen statt überflutet werden.

## Ausgaben

| Ausgabe | Datei | Zeit (Europe/Berlin) | Schwerpunkt |
|---|---|---|---|
| Morgen | `articles/JJJJ-MM-TT-morgen.md` | ca. 07:00 | Was über Nacht passiert ist (USA, Asien, Nahost) und was heute ansteht |
| Mittag | `articles/JJJJ-MM-TT-mittag.md` | ca. 12:00 | Entwicklungen seit dem Morgen, Europa-Handel, neue Daten |
| Abend | `articles/JJJJ-MM-TT-abend.md` | ca. 18:00 | Tagesbilanz, Einordnung, Ausblick auf morgen |

Jede Ausgabe bringt **neue** Informationen. Vorher die letzten zwei Ausgaben lesen und nichts wiederholen, außer es gibt eine echte Entwicklung (dann kurz darauf verweisen).

## Inhalt

1. **Kurz gesagt:** drei Stichpunkte, jeder ein vollständiger Satz mit Quelle.
2. **Drei bis vier Themen**, nummeriert (`## 1. Thema: Aussage`). Nur, was wirklich zählt. Pro Thema: was passiert ist (Fakten mit Zahlen), warum es wichtig ist. Lieber ein Thema weglassen als dünn berichten.
3. **Viral im Netz:** ein bis drei Beiträge aus X, Reddit oder anderen Netzwerken, die gerade breit diskutiert werden. Immer als Kasten `[!GERÜCHT]` (unbestätigt) oder `[!SOCIAL]` (Inhalt durch seriöse Quelle belegt). Wenn X oder Reddit nicht erreichbar sind, das offen sagen und nur Beiträge nehmen, über die Medien berichten. Nichts erfinden.
4. **Zum Lernen:** ein Kasten `[!LERNEN]`, der einen Begriff oder Mechanismus aus der Ausgabe erklärt (z. B. Kerninflation, Staking, Rendite einer Anleihe, Ölpreis und Inflation).
5. **Zum Nachdenken:** ein Kasten `[!FRAGE]` mit einer offenen Frage, gern mit Bezug zu Amirs Arbeit oder Nebenprojekt. Keine Ratschläge, keine Lebensweisheiten.

Länge: 700 bis 1.200 Wörter. Sprache: Deutsch, klar, sachlich, ganze Sätze, keine Gedankenstriche als Satzzeichen.

## Regeln (nicht verhandelbar)

- **Jede Zahl, jedes Zitat und jedes Ereignis bekommt eine Quelle** als `[n]` oder `[n, m]` direkt im Satz. Nur Quellen nennen, die tatsächlich gelesen wurden.
- **Keine erfundenen Zitate, Zahlen oder Daten.** Wenn eine Seite nicht abrufbar war, nicht aus der Suchvorschau „ergänzen“. Lieber weglassen.
- **Spekulation und Einordnung trennen:** Eigene Bewertung steht in `[!EINORDNUNG]` oder `[!SPEKULATION]`. Prognosen von Analysten als solche zuordnen („laut …“).
- **Social Media ist unbestätigt**, bis eine seriöse Quelle den Inhalt belegt. Accountname und Link angeben, Reichweite nur nennen, wenn sie sichtbar ist.
- **Krypto ohne Anlageberatungs-Ton:** keine Kursziele, keine Kauf-/Verkaufssignale, keine „Chance“-Rhetorik. Kursbewegungen berichten und erklären. Presale-, Shill- und „100x“-Artikel nicht als Quelle verwenden.
- Bei widersprüchlichen Berichten beide Versionen nennen und das kennzeichnen.
- Zeiten in deutscher Zeit angeben.

## Callout-Kästen

```markdown
> [!LERNEN]
> Text …
```

Verfügbar: `[!GERÜCHT]`, `[!SOCIAL]`, `[!SPEKULATION]`, `[!EINORDNUNG]`, `[!LERNEN]`, `[!FRAGE]`. Tabellen sind erlaubt (z. B. „Die Woche im Blick“).

## Dateiformat

```markdown
---
id: 2026-10-12-morgen            # muss dem Dateinamen entsprechen
title: "Überschrift mit Aussage, nicht nur Thema"
date: 2026-10-12
edition: morgen                  # morgen | mittag | abend
time: "07:05"                    # immer in Anführungszeichen
summary: "Zwei Sätze, die die Ausgabe zusammenfassen."
labels: [Iran, USA, Wirtschaft]
sources:
  - id: 1
    title: "Originaltitel der Quelle"
    publisher: "Reuters"         # Texte mit Doppelpunkt oder Klammern immer in Anführungszeichen
    url: "https://…"
    type: news                   # news | official | data | analysis | x | reddit | social | video | podcast
    date: 2026-10-12
---

## Kurz gesagt
…
```

Erlaubte Labels: Wirtschaft, Märkte, Zinsen, Deutschland, Europa, Energie, Krypto, Bitcoin, Ethereum, Hedera, Iran, USA, Naher Osten, Israel, Geopolitik, KI, Tech. Nur Labels setzen, die im Text auch wirklich vorkommen. Ein neues Label nur, wenn ein Thema dauerhaft wichtig wird; dann in `scripts/build_index.py` (LABELS) und `assets/app.js` (LABEL_COLORS) ergänzen.

## Veröffentlichen

```bash
python3 scripts/build_index.py      # prüft alle Artikel und schreibt articles/index.json
git add articles && git commit -m "Ausgabe: 2026-10-12 morgen" && git push origin main
```

Wenn das Skript Fehler meldet, den Artikel korrigieren. Nie ohne erfolgreichen Lauf pushen.
