"""Resolve and download every runtime dependency of the built Qiskit wheels.

For each Qiskit version, walks its Requires-Dist tree as seen from Pyodide
(sys_platform=emscripten, Python 3.14). Packages that Pyodide ships (numpy, scipy, ...)
are loaded from Pyodide itself. Everything else is downloaded into the wheels folder:
a pyemscripten wheel when PyPI has one (e.g. rustworkx), otherwise a pure-Python wheel.

Writes <wheels>/qiskit-<version>.deps.json, consumed by make_index.py.

Usage: python vendor_deps.py <wheels-dir> <pyodide-version> <qiskit-version>...
(Run with the build venv's Python: it needs `packaging`.)
"""

from __future__ import annotations

import hashlib
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

from packaging.markers import default_environment
from packaging.requirements import Requirement
from packaging.utils import canonicalize_name, parse_wheel_filename
from packaging.version import Version

ENV = default_environment() | {
    "sys_platform": "emscripten",
    "platform_system": "Emscripten",
    "platform_machine": "wasm32",
    "python_version": "3.14",
    "python_full_version": "3.14.2",
    "implementation_name": "cpython",
    "extra": "",
}
WASM_TAG = "pyemscripten_2026_0_wasm32"


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url) as r:
        return json.load(r)


def requires(wheel: Path) -> list[Requirement]:
    with zipfile.ZipFile(wheel) as z:
        meta = next(n for n in z.namelist() if n.endswith(".dist-info/METADATA"))
        lines = z.read(meta).decode().splitlines()
    reqs = [Requirement(l.split(":", 1)[1].strip()) for l in lines if l.startswith("Requires-Dist:")]
    return [r for r in reqs if r.marker is None or r.marker.evaluate(ENV)]


def compatible(filename: str) -> bool:
    if not filename.endswith(".whl"):
        return False
    _, _, _, tags = parse_wheel_filename(filename)
    for t in tags:
        if t.platform == "any" and t.interpreter.startswith("py"):
            return True
        if t.platform == WASM_TAG and t.abi in ("abi3", "cp314"):
            return True
    return False


def pick(req: Requirement) -> tuple[str, str, str]:
    """Highest version satisfying req with a usable wheel -> (version, filename, url)."""
    data = fetch_json(f"https://pypi.org/pypi/{req.name}/json")
    for v in sorted(data["releases"], key=Version, reverse=True):
        ver = Version(v)
        if ver.is_prerelease or not req.specifier.contains(ver):
            continue
        files = [f for f in data["releases"][v] if not f.get("yanked") and compatible(f["filename"])]
        files.sort(key=lambda f: WASM_TAG not in f["filename"])  # prefer the wasm build
        if files:
            return v, files[0]["filename"], files[0]["url"]
    sys.exit(f"no usable wheel for {req}")


def main(out: Path, pyodide_version: str, versions: list[str]) -> None:
    lock = fetch_json(f"https://cdn.jsdelivr.net/pyodide/v{pyodide_version}/full/pyodide-lock.json")
    in_pyodide = {canonicalize_name(n): p["version"] for n, p in lock["packages"].items()}

    for qv in versions:
        root = next(out.glob(f"qiskit-{qv}-*.whl"))
        wheels: list[str] = []
        pyodide_pkgs: dict[str, str] = {}
        seen: set[str] = set()
        queue = requires(root)
        while queue:
            req = queue.pop(0)
            name = canonicalize_name(req.name)
            if name in seen:
                continue
            seen.add(name)
            if name in in_pyodide:
                if not req.specifier.contains(in_pyodide[name], prereleases=True):
                    sys.exit(f"Pyodide ships {name} {in_pyodide[name]}, qiskit {qv} needs {req}")
                pyodide_pkgs[name] = in_pyodide[name]
                continue
            v, fname, url = pick(req)
            dest = out / fname
            if not dest.exists():
                print(f"  download {fname}")
                urllib.request.urlretrieve(url, dest)
            wheels.append(fname)
            queue.extend(requires(dest))
        # Dependencies first, Qiskit last.
        wheels = list(reversed(wheels)) + [root.name]
        deps = {
            "qiskit": qv,
            "wheels": wheels,
            "pyodidePackages": pyodide_pkgs,
            "sha256": {w: hashlib.sha256((out / w).read_bytes()).hexdigest() for w in wheels},
        }
        (out / f"qiskit-{qv}.deps.json").write_text(json.dumps(deps, indent=2) + "\n")
        print(f"qiskit {qv}: {len(wheels)} wheels, from Pyodide: {', '.join(pyodide_pkgs)}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), sys.argv[2], sys.argv[3:])
