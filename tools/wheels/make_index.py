"""Write public/runtimes/index.json: the registry of Qiskit runtimes the app can load.

Every qiskit-<version>.deps.json in the wheels folder becomes one selectable version.

Usage: python make_index.py <runtimes-dir> <pyodide-version>
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from packaging.version import Version


def main(root: Path, pyodide_version: str) -> None:
    versions = {}
    for f in sorted((root / "wheels").glob("qiskit-*.deps.json")):
        d = json.loads(f.read_text())
        versions[d["qiskit"]] = {k: d[k] for k in ("wheels", "pyodidePackages", "sha256")}
    if not versions:
        sys.exit("no built Qiskit versions found")
    ordered = sorted(versions, key=Version, reverse=True)
    index = {
        "schemaVersion": 1,
        "pyodide": {
            "version": pyodide_version,
            "indexURL": f"https://cdn.jsdelivr.net/pyodide/v{pyodide_version}/full/",
        },
        "default": ordered[0],
        "qiskit": {v: versions[v] for v in ordered},
    }
    (root / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    print(f"index.json: qiskit {', '.join(ordered)} (default {ordered[0]})")


if __name__ == "__main__":
    main(Path(sys.argv[1]), sys.argv[2])
