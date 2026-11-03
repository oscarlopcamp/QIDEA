"""Make a Qiskit source tree build and run under Pyodide (wasm32-unknown-emscripten).

Applied as targeted, version-tolerant edits (not a fixed diff) so the same script
works across Qiskit releases. Every edit must either apply or already be present;
anything else aborts the build loudly.

Edits (approach credited to QisPlay, MIT, https://github.com/kriss-u/QisPlay):
  1. faer without its default "rayon" feature: rayon -> spindle -> atomic-wait has no
     emscripten backend.
  2. crossterm only on non-emscripten targets: it pulls in mio, which has no wasm support.
     The text circuit drawer assumes 80 columns instead.
  3. PrimitiveJob runs synchronously: Pyodide cannot start threads.
  4. parallel_map never uses processes: Pyodide cannot spawn them.

Usage: python3 patch_qiskit.py <qiskit-source-dir>
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

MARK = "QIDEA-EMSCRIPTEN"


def edit(path: Path, fn) -> None:
    text = path.read_text()
    if MARK in text:
        print(f"  already patched: {path}")
        return
    new = fn(text)
    if new == text:
        sys.exit(f"patch failed: nothing changed in {path}")
    path.write_text(new)
    print(f"  patched: {path}")


def sub_once(pattern: str, repl: str, text: str, flags: int = re.M) -> str:
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        sys.exit(f"patch failed: pattern not found: {pattern!r}")
    return new


def main(root: Path) -> None:
    # 1. faer without rayon
    edit(
        root / "Cargo.toml",
        lambda t: sub_once(
            r'^faer = "([^"]+)"$',
            rf'# {MARK}: no rayon (spindle -> atomic-wait lacks an emscripten backend)\n'
            r'faer = { version = "\1", default-features = false, features = ["std", "sparse-linalg", "rand"] }',
            t,
        ),
    )

    # 2. crossterm only off-wasm
    def circuit_toml(t: str) -> str:
        m = re.search(r'^crossterm = "([^"]+)"\n', t, flags=re.M)
        if not m:
            sys.exit("patch failed: crossterm dependency not found")
        t = t.replace(m.group(0), "", 1)
        block = (
            f"\n# {MARK}: crossterm depends on mio, which does not support WebAssembly.\n"
            "[target.'cfg(not(target_os = \"emscripten\"))'.dependencies]\n"
            f'crossterm = "{m.group(1)}"\n'
        )
        return sub_once(r"^\[dependencies\.pyo3\]", block.lstrip("\n") + "\n[dependencies.pyo3]", t)

    edit(root / "crates/circuit/Cargo.toml", circuit_toml)

    def drawer(t: str) -> str:
        t = sub_once(
            r"^use crossterm::terminal;$",
            f'// {MARK}\n#[cfg(not(target_os = "emscripten"))]\nuse crossterm::terminal;',
            t,
        )
        return sub_once(
            r"^(\s*)let \(term_width, _\) = terminal::size\(\)\.unwrap_or\(\(80, 24\)\);$",
            r'\1#[cfg(target_os = "emscripten")]\n\1let term_width: u16 = 80;\n'
            r'\1#[cfg(not(target_os = "emscripten"))]\n\1let (term_width, _) = terminal::size().unwrap_or((80, 24));',
            t,
        )

    edit(root / "crates/circuit/src/circuit_drawer.rs", drawer)

    # 3. synchronous primitive jobs
    def primitive_job(t: str) -> str:
        t = sub_once(
            r"^from concurrent\.futures import ThreadPoolExecutor$",
            f"import sys  # {MARK}\nfrom concurrent.futures import Future, ThreadPoolExecutor",
            t,
        )
        return sub_once(
            r"^(\s*)executor = ThreadPoolExecutor\(max_workers=1\)$",
            r'\1if sys.platform == "emscripten":\n'
            r"\1    # Pyodide cannot start threads: run now, on this thread.\n"
            r"\1    self._future = Future()\n"
            r"\1    try:\n"
            r"\1        self._future.set_result(self._function(*self._args, **self._kwargs))\n"
            r"\1    except Exception as exc:  # pylint: disable=broad-except\n"
            r"\1        self._future.set_exception(exc)\n"
            r"\1    return\n"
            r"\1executor = ThreadPoolExecutor(max_workers=1)",
            t,
        )

    edit(root / "qiskit/primitives/primitive_job.py", primitive_job)

    # 4. no process parallelism
    edit(
        root / "qiskit/utils/parallel.py",
        lambda t: sub_once(
            r"^(\s*)num_processes = default_num_processes\(\) if num_processes is None else num_processes$",
            rf'\1if sys.platform == "emscripten":  # {MARK}: Pyodide cannot spawn processes.\n'
            r"\1    return False\n"
            r"\1num_processes = default_num_processes() if num_processes is None else num_processes",
            t,
        ),
    )

    leftovers = [
        str(p) for p in root.rglob("*.rs") if "crossterm" in p.read_text() and MARK not in p.read_text()
    ]
    if leftovers:
        sys.exit(f"patch failed: unguarded crossterm use in {leftovers}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
