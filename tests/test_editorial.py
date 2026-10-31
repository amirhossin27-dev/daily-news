import contextlib
import datetime as dt
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from build_index import check
from editorial import build, digest, iso_date, learning_items


def edition(previous=None):
    meta = {"id": "2026-11-01-morgen", "title": "Ausführliche Testausgabe", "date": "2026-11-01", "edition": "morgen", "time": "07:00", "summary": "Eine Testzusammenfassung.", "labels": ["Wirtschaft"], "sources": [{"id": n, "title": f"Quelle {n}", "publisher": "Testquelle", "url": f"https://example.com/{n}", "type": "news", "date": "2026-11-01"} for n in range(1, 4)]}
    body = "## Kurz gesagt\n\n- Aussage eins. [1]\n- Aussage zwei. [2]\n- Aussage drei. [3]\n\n"
    body += "## Neu seit der letzten Ausgabe\n\nEine neue Entwicklung." + (f" [Vorherige Ausgabe](#/artikel/{previous})" if previous else "") + "\n\n"
    for n in range(1, 4):
        body += f"## {n}. Ein substantiiertes Thema\n\n" + "Erklärung " * 230 + f"[1, 2, 3]\n\n"
    body += "> [!LERNEN]\n> Ein Mechanismus mit Kontext.\n> Eine weitere Erklärung.\n\n> [!FRAGE]\n> Was folgt daraus?\n"
    return meta, body


class EditorialTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "articles").mkdir()
        (self.root / "scripts").mkdir()
        self.path = self.root / "articles" / "2026-11-01-morgen.md"

    def tearDown(self):
        self.temp.cleanup()

    def write(self, meta, body):
        self.path.write_text("---\n" + yaml.safe_dump(meta, allow_unicode=True, sort_keys=False) + "---\n\n" + body, encoding="utf-8")

    def test_valid_article_and_deterministic_indexes(self):
        self.write(*edition())
        article, errors, _ = check(self.path)
        self.assertFalse(errors)
        self.assertTrue(700 <= article["words"] <= 1200)
        first = build(self.root, check)
        self.assertEqual(first, build(self.root, check))
        self.assertEqual(first["index.json"]["generated"], "2026-11-01T06:00:00+00:00")
        self.assertIn("Erklärung", first["search-index.json"]["documents"][0]["text"])
        self.assertEqual(len(first["learning.json"]["items"]), 1)
        self.assertIn("weitere Erklärung", first["learning.json"]["items"][0]["text"])

    def test_invalid_calendar_time_source_types_and_citations(self):
        for change in (lambda m: m.update(date="2026-02-30"), lambda m: m.update(time="24:99"), lambda m: m.update(sources={}), lambda m: m["sources"][0].update(id=True), lambda m: m["sources"][0].update(id=[]), lambda m: m["sources"][0].update(type=[]), lambda m: m["sources"][0].update(url="javascript:alert(1)"), lambda m: m["sources"][0].update(date="2026-11-40"), lambda m: m.update(labels=[{}])):
            meta, body = edition(); change(meta); self.write(meta, body)
            self.assertTrue(check(self.path)[1])
        meta, body = edition(); self.write(meta, body + "Unbekannte Quelle [9].")
        self.assertTrue(any("Quelle [9]" in e for e in check(self.path)[1]))

    def test_editorial_structure_and_word_limits(self):
        for transform in (lambda b: b.replace("- Aussage drei. [3]", ""), lambda b: b.replace("[!LERNEN]", "[!SOCIAL]"), lambda b: b.replace("[!FRAGE]", "[!SOCIAL]"), lambda b: b.replace("## 3.", "## Thema drei"), lambda b: b + "Lang " * 1300, lambda b: b[:120]):
            meta, body = edition(); self.write(meta, transform(body))
            self.assertTrue(check(self.path)[1])

    def test_legacy_only_when_exact_content_matches(self):
        meta, _ = edition(); self.write(meta, "## Kurz gesagt\n\n- Altbestand [1, 2, 3].\n")
        self.assertTrue(check(self.path)[1])
        self.assertFalse(check(self.path, legacy=True)[1])
        self.assertTrue(check(self.path, legacy=True)[2])
        baseline = {self.path.name: digest(self.path.read_text(encoding="utf-8"))}
        (self.root / "scripts" / "legacy_articles.json").write_text(json.dumps(baseline), encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(len(build(self.root, check)["index.json"]["articles"]), 1)
            self.path.write_text(self.path.read_text(encoding="utf-8") + "Bearbeitet.", encoding="utf-8")
            with self.assertRaises(ValueError):
                build(self.root, check)

    def test_corrections_require_note_timezone_and_sensible_time(self):
        for fields in ({"updated_at": "2026-11-01T08:00:00+01:00"}, {"correction_note": "Korrigiert"}, {"updated_at": "2026-11-01T08:00:00", "correction_note": "Korrigiert"}, {"updated_at": "2026-10-01T08:00:00+02:00", "correction_note": "Korrigiert"}):
            meta, body = edition(); meta.update(fields); self.write(meta, body); self.assertTrue(check(self.path)[1])
        meta, body = edition(); meta.update(updated_at="2026-11-01T08:00:00+01:00", correction_note="Die Zahl wurde anhand der Originalquelle korrigiert."); self.write(meta, body)
        self.assertFalse(check(self.path)[1]); self.assertEqual(build(self.root, check)["index.json"]["generated"], "2026-11-01T07:00:00+00:00")

    def test_empty_archive_and_actual_date_objects(self):
        self.assertEqual(build(self.root, check)["index.json"]["articles"], [])
        self.assertEqual(iso_date(dt.date(2026, 10, 31)), "2026-10-31")
        with self.assertRaises(ValueError):
            iso_date(dt.datetime.now())

    def test_previous_edition_link_is_required(self):
        meta, body = edition(); self.write(meta, body)
        old = self.root / "articles" / "2026-10-31-abend.md"
        oldmeta, oldbody = edition(); oldmeta.update(id=old.stem, date="2026-10-31", edition="abend")
        for source in oldmeta["sources"]:
            source["date"] = "2026-10-31"
        old.write_text("---\n" + yaml.safe_dump(oldmeta, allow_unicode=True) + "---\n" + oldbody, encoding="utf-8")
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(ValueError):
            build(self.root, check)
        self.write(*edition(old.stem))
        self.assertEqual(build(self.root, check)["index.json"]["articles"][0]["previous_id"], old.stem)


if __name__ == "__main__":
    unittest.main()
