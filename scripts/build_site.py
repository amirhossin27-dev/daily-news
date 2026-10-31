"""Stamp the offline shell; package only web assets after successful validation."""
import hashlib
import json
import re
import shutil
from pathlib import Path

from build_index import ROOT, check
from editorial import build


def prepare(root=ROOT):
    indexes = build(root, check)  # Validate everything before writing build outputs.
    for name, payload in indexes.items():
        (root / "articles" / name).write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    files = ["index.html", "manifest.webmanifest", "articles/index.json", "articles/learning.json"]
    files += sorted(path.relative_to(root).as_posix() for path in (root / "assets").rglob("*") if path.is_file())
    version = hashlib.sha256(b"".join(name.encode() + (root / name).read_bytes() for name in files)).hexdigest()[:16]
    (root / "precache.json").write_text(json.dumps({"version": version, "files": files}, indent=2) + "\n", encoding="utf-8")
    sw = root / "sw.js"
    source = re.sub(r"// build-version: \S+", "// build-version: " + version, sw.read_text(encoding="utf-8"))
    source = re.sub(r"const BUILD_VERSION = '[^']+';", f"const BUILD_VERSION = '{version}';", source)
    sw.write_text(source, encoding="utf-8")
    destination = root / "_site"
    if destination.is_symlink() or destination.resolve() != root.resolve() / "_site":
        raise ValueError("Unsicherer Build-Zielpfad")
    destination.mkdir(exist_ok=True)
    # Stale outputs must not survive between builds. Only remove this known build folder's children.
    for child in destination.iterdir():
        if not child.is_symlink() and not child.resolve().is_relative_to(destination.resolve()):
            raise ValueError("Build-Ausgabe verweist außerhalb von _site")
        if child.is_symlink():
            child.unlink()
        elif child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()
    for name in ("index.html", "manifest.webmanifest", "precache.json", "sw.js", ".nojekyll"):
        shutil.copy2(root / name, destination / name)
    for name in ("assets", "articles"):
        shutil.copytree(root / name, destination / name)
    print(f"OK: Web-Ausgabe in _site, Offline-Version {version}")
    return destination


if __name__ == "__main__":
    prepare()
