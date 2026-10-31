"""Protect the frozen historical allowlist against accidental regeneration."""
import json
import subprocess

from build_index import ROOT
from editorial import digest

HISTORICAL_COMMIT = "668a9c01198101960992caf679d9a42e9cbe3079"


def verify():
    def git(*args):
        return subprocess.check_output(["git", "-C", str(ROOT), *args])
    names = git("ls-tree", "-r", "--name-only", HISTORICAL_COMMIT, "articles").decode().splitlines()
    expected = {name.split("/")[-1]: digest(git("show", f"{HISTORICAL_COMMIT}:{name}").decode("utf-8")) for name in names if name.endswith(".md")}
    actual = json.loads((ROOT / "scripts" / "legacy_articles.json").read_text(encoding="utf-8"))
    if actual != expected:
        raise ValueError("Der historische Ausgangsbestand wurde verändert. Neue oder bearbeitete Artikel dürfen nicht als Altbestand freigegeben werden.")
    print(f"OK: Historischer Ausgangsbestand ({len(expected)} Dateien) unverändert")


if __name__ == "__main__":
    verify()
