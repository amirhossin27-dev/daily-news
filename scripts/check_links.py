"""Best-effort reachability for sources in changed editions. Never claims fact checking."""
import argparse
import concurrent.futures
import subprocess
import urllib.error
import urllib.request

from build_index import ROOT
from editorial import split


def changed_paths(base):
    if not base or set(base) == {"0"}:
        print("HINWEIS: Kein Vergleichsstand für Quellenprüfung; bei Bedarf manuell mit --all ausführen.")
        return []
    try:
        names = subprocess.check_output(["git", "-C", str(ROOT), "diff", "--name-only", "--diff-filter=AM", base, "HEAD", "--", "articles/*.md"], text=True).splitlines()
        return [ROOT / name for name in names]
    except subprocess.CalledProcessError:
        print("HINWEIS: Vergleichsstand nicht verfügbar; Quellenprüfung übersprungen.")
        return []


def probe(url):
    try:
        request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "DailyBrief-LinkCheck/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=6) as response:
                return url, response.status, None
        except urllib.error.HTTPError as error:
            if error.code not in (403, 405):
                raise
            request = urllib.request.Request(url, headers={"User-Agent": "DailyBrief-LinkCheck/1.0", "Range": "bytes=0-1023"})
            with urllib.request.urlopen(request, timeout=6) as response:
                return url, response.status, None
    except Exception as error:
        return url, None, str(error)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()
    paths = list((ROOT / "articles").glob("*.md")) if args.all else changed_paths(args.base)
    urls = {source["url"] for path in paths for source in split(path.read_text(encoding="utf-8"))[0].get("sources", [])}
    warnings = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for url, status, error in pool.map(probe, sorted(urls)):
            if error:
                warnings += 1
                print(f"WARNUNG Quelle nicht abrufbar: {url}: {error}")
    print(f"{len(urls)} Quellenlinks geprüft, {warnings} Hinweise. Erreichbarkeit ist kein Beleg für die Aussage.")


if __name__ == "__main__":
    main()
