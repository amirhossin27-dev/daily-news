#!/usr/bin/env python3
"""Prüft alle Artikel in articles/*.md und schreibt articles/index.json.

Aufruf aus dem Repo-Wurzelverzeichnis:  python3 scripts/build_index.py
Bricht mit Exit-Code 1 ab, wenn ein Artikel gegen die Regeln in REDAKTION.md verstößt.
"""
import datetime as dt
import json
import math
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
ARTICLES = ROOT / "articles"
EDITIONS = {"morgen", "mittag", "abend"}
SOURCE_TYPES = {"news", "official", "data", "analysis", "x", "reddit", "social", "video", "podcast"}
LABELS = {
    "Wirtschaft", "Märkte", "Zinsen", "Deutschland", "Europa", "Energie",
    "Krypto", "Bitcoin", "Ethereum", "Hedera",
    "Iran", "USA", "Naher Osten", "Israel", "Geopolitik", "KI", "Tech",
}
CITE = re.compile(r"\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?!\(|\[|:\s*https?:)")


def split_frontmatter(text):
    if not text.startswith("---\n"):
        raise ValueError("Frontmatter fehlt (Datei muss mit --- beginnen)")
    end = text.find("\n---", 4)
    if end == -1:
        raise ValueError("Frontmatter wird nicht mit --- abgeschlossen")
    meta = yaml.safe_load(text[4:end]) or {}
    body = text[text.index("\n", end + 1) + 1:]
    return meta, body


def norm_time(v):
    if isinstance(v, int):  # YAML 1.1 liest 21:45 ohne Anführungszeichen als Sexagesimalzahl
        return f"{v // 60:02d}:{v % 60:02d}"
    return str(v)


def check(path):
    errors, warnings = [], []
    meta, body = split_frontmatter(path.read_text(encoding="utf-8"))

    for key in ("id", "title", "date", "edition", "time", "summary", "labels", "sources"):
        if not meta.get(key):
            errors.append(f"Feld '{key}' fehlt oder ist leer")
    if errors:
        return None, errors, warnings

    date = meta["date"]
    date = date.isoformat() if isinstance(date, (dt.date, dt.datetime)) else str(date)
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
        errors.append(f"date '{date}' ist nicht im Format JJJJ-MM-TT")
    time = norm_time(meta["time"])
    if not re.fullmatch(r"\d{2}:\d{2}", time):
        errors.append(f"time '{time}' ist nicht im Format HH:MM")
    if meta["id"] != path.stem:
        errors.append(f"id '{meta['id']}' muss dem Dateinamen '{path.stem}' entsprechen")
    if meta["edition"] not in EDITIONS:
        errors.append(f"edition '{meta['edition']}' muss morgen, mittag oder abend sein")

    labels = meta["labels"]
    if not isinstance(labels, list):
        errors.append("labels muss eine Liste sein")
        labels = []
    for label in labels:
        if label not in LABELS:
            warnings.append(f"unbekanntes Label '{label}' (neu? dann in LABELS und app.js ergänzen)")

    sources, ids = [], set()
    for i, s in enumerate(meta["sources"], 1):
        if not isinstance(s, dict):
            errors.append(f"Quelle #{i} ist kein Eintrag mit id/title/url/type")
            continue
        for key in ("id", "title", "url", "type"):
            if not s.get(key):
                errors.append(f"Quelle #{i}: Feld '{key}' fehlt")
        if s.get("url") and not str(s["url"]).startswith("https://"):
            errors.append(f"Quelle #{i}: url muss mit https:// beginnen")
        if s.get("type") and s["type"] not in SOURCE_TYPES:
            errors.append(f"Quelle #{i}: type '{s['type']}' unbekannt ({', '.join(sorted(SOURCE_TYPES))})")
        if s.get("id") in ids:
            errors.append(f"Quelle #{i}: id {s['id']} doppelt")
        ids.add(s.get("id"))
        entry = {k: s[k] for k in ("id", "title", "publisher", "url", "type") if s.get(k) is not None}
        if s.get("date"):
            d = s["date"]
            entry["date"] = d.isoformat() if isinstance(d, (dt.date, dt.datetime)) else str(d)
        sources.append(entry)

    cited = {int(n) for m in CITE.finditer(body) for n in re.split(r"\s*,\s*", m.group(1))}
    for n in sorted(cited - ids):
        errors.append(f"Text verweist auf Quelle [{n}], die nicht in sources steht")
    for n in sorted(ids - cited):
        warnings.append(f"Quelle {n} wird im Text nie zitiert")
    if len(sources) < 3:
        errors.append("mindestens 3 Quellen nötig")

    words = len(re.findall(r"\w+", CITE.sub("", body)))
    article = {
        "id": meta["id"],
        "file": path.name,
        "title": str(meta["title"]),
        "summary": str(meta["summary"]),
        "date": date,
        "edition": meta["edition"],
        "time": time,
        "labels": labels,
        "sources": sources,
        "words": words,
        "reading_minutes": max(1, math.ceil(words / 220)),
    }
    return article, errors, warnings


def main():
    articles, failed = [], False
    for path in sorted(ARTICLES.glob("*.md")):
        try:
            article, errors, warnings = check(path)
        except Exception as exc:  # kaputtes YAML o. Ä.
            article, errors, warnings = None, [str(exc)], []
        for w in warnings:
            print(f"WARNUNG {path.name}: {w}")
        for e in errors:
            print(f"FEHLER  {path.name}: {e}")
        if errors:
            failed = True
        elif article:
            articles.append(article)

    if failed:
        print("Abbruch: index.json wurde NICHT geschrieben.")
        sys.exit(1)

    articles.sort(key=lambda a: (a["date"], a["time"]), reverse=True)
    out = {"generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "articles": articles}
    (ARTICLES / "index.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"OK: {len(articles)} Artikel in articles/index.json")


if __name__ == "__main__":
    main()
