"""Editorial contract and deterministic indexes. No network requests during validation."""
import argparse
import datetime as dt
import hashlib
import json
import re
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import yaml


def digest(text):
    return hashlib.sha256(text.replace("\r\n", "\n").encode("utf-8")).hexdigest()


def split(text):
    match = re.match(r"\A---\n(.*?)\n---(?:\n|$)", text.replace("\r\n", "\n"), re.S)
    if not match:
        raise ValueError("Frontmatter fehlt oder ist nicht abgeschlossen")
    meta = yaml.safe_load(match[1])
    if not isinstance(meta, dict):
        raise ValueError("Frontmatter muss ein Objekt sein")
    return meta, text.replace("\r\n", "\n")[match.end():]


def iso_date(value):
    if isinstance(value, dt.datetime):
        raise ValueError("Datum darf keine Uhrzeit enthalten")
    value = value.isoformat() if isinstance(value, dt.date) else str(value)
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Datum muss JJJJ-MM-TT sein")
    return dt.date.fromisoformat(value).isoformat()


def plain_text(text):
    text = re.sub(r"<[^>]*>", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\[\d+(?:\s*,\s*\d+)*\]", "", text)
    text = re.sub(r"\[![A-ZÄÖÜ]+\]", "", text)
    return re.sub(r"\s+", " ", re.sub(r"[#>*_|]", " ", text.replace(chr(96), ""))).strip()


def validate(path, legacy, base):
    errors, warnings = [], []
    meta, body = split(path.read_text(encoding="utf-8"))
    for key in ("id", "title", "summary", "edition", "time"):
        if not isinstance(meta.get(key), str) or not meta[key].strip():
            errors.append(f"{key} muss nichtleerer Text sein")
    date = ""
    try:
        date = iso_date(meta.get("date"))
    except (ValueError, TypeError):
        errors.append("date ist kein gültiges Datum JJJJ-MM-TT")
    if not isinstance(meta.get("time"), str) or not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", meta["time"]):
        errors.append("time muss eine zitierte, gültige Uhrzeit HH:MM sein")
    if date and meta.get("id") != f"{date}-{meta.get('edition')}":
        errors.append("id, date und edition widersprechen sich")
    if not isinstance(meta.get("labels"), list) or not all(isinstance(x, str) for x in meta["labels"]):
        errors.append("labels muss eine Textliste sein")
    if not isinstance(meta.get("sources"), list):
        errors.append("sources muss eine Liste sein")
    else:
        for i, source in enumerate(meta["sources"], 1):
            if not isinstance(source, dict):
                errors.append(f"Quelle {i} muss ein Objekt sein")
                continue
            if type(source.get("id")) is not int or not 1 <= source["id"] <= 99:
                errors.append(f"Quelle {i}: id muss eine ganze Zahl von 1 bis 99 sein")
            for key in ("title", "url", "type"):
                if not isinstance(source.get(key), str) or not source[key].strip():
                    errors.append(f"Quelle {i}: {key} muss Text sein")
            if source.get("publisher") is not None and not isinstance(source["publisher"], str):
                errors.append(f"Quelle {i}: publisher muss Text sein")
            if not source.get("publisher") or not source.get("date"):
                (warnings if legacy else errors).append(f"Quelle {i}: publisher und date erforderlich")
            try:
                url = urlparse(source.get("url", ""))
                if url.scheme != "https" or not url.hostname or url.username or url.password or re.search(r"\s", source["url"]):
                    raise ValueError("URL ungültig")
                url.port
            except (ValueError, TypeError, AttributeError, KeyError):
                errors.append(f"Quelle {i}: gültige HTTPS-URL erforderlich")
            if source.get("date"):
                try:
                    source_date = iso_date(source["date"])
                    if date and source_date > date:
                        (warnings if legacy else errors).append(f"Quelle {i}: Quelldatum liegt nach der Ausgabe")
                except (ValueError, TypeError):
                    errors.append(f"Quelle {i}: ungültiges Quelldatum")
    if errors:
        return None, errors, warnings
    article, base_errors, base_warnings = base(path)
    errors.extend(base_errors)
    # Unknown labels are errors for new/edited articles, not silently accepted.
    for warning in base_warnings:
        (errors if not legacy and warning.startswith("unbekanntes Label") else warnings).append(warning)
    target = warnings if legacy else errors
    if len(meta["labels"]) != len(set(meta["labels"])):
        target.append("Labels dürfen nicht doppelt vorkommen")
    if article and not 700 <= article["words"] <= 1200:
        target.append(f"{article['words']} Wörter, erforderlich sind 700–1.200")
    short = re.search(r"^## Kurz gesagt\s*\n(.*?)(?=^## |\Z)", body, re.M | re.S)
    if not short or len(re.findall(r"^\s*[-*+]\s+", short[1], re.M)) != 3:
        target.append("Kurz gesagt muss genau drei Stichpunkte enthalten")
    if not 3 <= len(re.findall(r"^## \d+\.\s+\S", body, re.M)) <= 4:
        target.append("Drei bis vier nummerierte Hauptthemen erforderlich")
    for tag in ("LERNEN", "FRAGE"):
        if not re.search(rf"^>\s*\[!{tag}\]\s*\n>\s*\S", body, re.M):
            target.append(f"Nichtleerer [!{tag}]-Kasten fehlt")
    if not re.search(r"^## Neu seit der letzten Ausgabe\s*$", body, re.M):
        target.append("Abschnitt 'Neu seit der letzten Ausgabe' fehlt")
    updated, note = meta.get("updated_at"), meta.get("correction_note")
    if updated or note:
        if not isinstance(note, str) or not note.strip():
            errors.append("correction_note muss eine verständliche Korrektur enthalten")
        try:
            stamp = dt.datetime.fromisoformat(str(updated).replace("Z", "+00:00"))
            published = dt.datetime.fromisoformat(f"{date}T{meta['time']}").replace(tzinfo=ZoneInfo("Europe/Berlin"))
            if stamp.utcoffset() is None or stamp < published:
                raise ValueError("Zeitpunkt ungültig")
        except (ValueError, TypeError):
            errors.append("updated_at muss ein ISO-Zeitpunkt mit Zeitzone nach Veröffentlichung sein")
        if article:
            article.update(updated_at=str(updated), correction_note=note)
    return article if not errors else None, errors, warnings


def learning_items(article, body):
    result = []
    for i, match in enumerate(re.finditer(r"^>\s*\[!LERNEN\][^\n]*\n(?:^>[^\n]*(?:\n|$))+", body, re.M)):
        text = plain_text(re.sub(r"^>\s?", "", match[0], flags=re.M))
        result.append({"id": f"{article['id']}-{i + 1}", "article_id": article["id"], "title": article["title"], "date": article["date"], "labels": article["labels"], "text": text})
    return result


def build(root, checker):
    baseline_path = root / "scripts" / "legacy_articles.json"
    baseline = json.loads(baseline_path.read_text(encoding="utf-8")) if baseline_path.exists() else {}
    articles, documents, learning, failed = [], [], [], False
    bodies, legacy_ids = {}, set()
    for path in sorted((root / "articles").glob("*.md")):
        text = path.read_text(encoding="utf-8")
        legacy = baseline.get(path.name) == digest(text)
        try:
            article, errors, warnings = checker(path, legacy)
        except (ValueError, TypeError, yaml.YAMLError) as exc:
            article, errors, warnings = None, [str(exc)], []
        if warnings:
            print(f"WARNUNG {path.name}: " + "; ".join(warnings))
        for error in errors:
            print(f"FEHLER {path.name}: {error}")
        failed |= bool(errors)
        if article:
            body = split(text)[1]
            articles.append(article)
            bodies[article["id"]] = body
            if legacy:
                legacy_ids.add(article["id"])
            documents.append({"id": article["id"], "text": plain_text(body)})
            learning.extend(learning_items(article, body))
    articles.sort(key=lambda a: (a["date"], a["time"]), reverse=True)
    for i, article in enumerate(articles):
        if i + 1 < len(articles):
            previous = articles[i + 1]["id"]
            article["previous_id"] = previous
            if article["id"] not in legacy_ids:
                section = re.search(r"^## Neu seit der letzten Ausgabe\s*\n(.*?)(?=^## |\Z)", bodies[article["id"]], re.M | re.S)
                if not section or f"#/artikel/{previous}" not in section[1]:
                    print(f"FEHLER {article['file']}: Neu-Abschnitt muss die vorherige Ausgabe {previous} verlinken")
                    failed = True
    if failed:
        raise ValueError("Abbruch: Keine Indexdatei wurde geschrieben.")
    stamps = [dt.datetime.fromisoformat(f"{a['date']}T{a['time']}").replace(tzinfo=ZoneInfo("Europe/Berlin")).astimezone(dt.timezone.utc) for a in articles]
    stamps.extend(dt.datetime.fromisoformat(a["updated_at"].replace("Z", "+00:00")).astimezone(dt.timezone.utc) for a in articles if a.get("updated_at"))
    generated = max(stamps).isoformat(timespec="seconds") if stamps else "1970-01-01T00:00:00+00:00"
    return {"index.json": {"generated": generated, "articles": articles}, "search-index.json": {"generated": generated, "documents": documents}, "learning.json": {"generated": generated, "items": sorted(learning, key=lambda x: x["date"], reverse=True)}}


def run(root, checker):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Nur prüfen, keine Dateien schreiben")
    args = parser.parse_args()
    try:
        output = build(root, checker)
    except (ValueError, OSError) as exc:
        print(str(exc))
        return 1
    if not args.check:
        for name, payload in output.items():
            (root / "articles" / name).write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"OK: {len(output['index.json']['articles'])} Ausgaben geprüft" + (" (ohne Schreiben)" if args.check else ", drei Indizes erzeugt"))
    return 0
