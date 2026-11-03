#!/usr/bin/env bash
# Build Qiskit WebAssembly wheels for Pyodide and publish them into public/runtimes/.
#
#   tools/wheels/build.sh 2.5.2 [2.6.1 ...]
#
# Needs: python3.14 (matching Pyodide's Python), rustup, curl.
# Work files go to $QIDEA_BUILD_DIR (default ~/.cache/qidea-wheels), outside the repo.
set -euo pipefail

PYODIDE_VERSION=314.0.7
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
TOOLS="$REPO/tools/wheels"
OUT="$REPO/public/runtimes/wheels"
WORK="${QIDEA_BUILD_DIR:-$HOME/.cache/qidea-wheels}"
export PATH="/opt/homebrew/opt/rustup/bin:$HOME/.cargo/bin:$PATH"

[ $# -ge 1 ] || { echo "usage: $0 <qiskit-version>..." >&2; exit 2; }
mkdir -p "$WORK"/{sdists,src,dist} "$OUT"
cd "$WORK"

# --- toolchain ---------------------------------------------------------------
if [ ! -x .venv/bin/pyodide ]; then
  python3.14 -m venv .venv
  .venv/bin/pip install -q --upgrade pip pyodide-build
fi
# shellcheck disable=SC1091
. .venv/bin/activate
pyodide xbuildenv install "$PYODIDE_VERSION"
pyodide xbuildenv install-emscripten
RUST_TOOLCHAIN=$(pyodide config get rust_toolchain)
rustup toolchain install "$RUST_TOOLCHAIN" --profile minimal --target wasm32-unknown-emscripten
export RUSTUP_TOOLCHAIN=$RUST_TOOLCHAIN
# python.org builds of Python ship without a CA bundle; use certifi's.
pip install -q certifi
SSL_CERT_FILE="$(python -c 'import certifi; print(certifi.where())')"
export SSL_CERT_FILE

sdist() { # name version -> path of the downloaded sdist
  local url
  url=$(curl -sf "https://pypi.org/pypi/$1/$2/json" |
    python3 -I -c "import json,sys;print([u['url'] for u in json.load(sys.stdin)['urls'] if u['packagetype']=='sdist'][0])")
  [ -f "sdists/$(basename "$url")" ] || curl -sfL "$url" -o "sdists/$(basename "$url")"
  echo "sdists/$(basename "$url")"
}

for V in "$@"; do
  echo "=== qiskit $V"
  rm -rf "src/qiskit-$V"
  tar xzf "$(sdist qiskit "$V")" -C src
  python3 -I "$TOOLS/patch_qiskit.py" "src/qiskit-$V"
  (cd "src/qiskit-$V" && QISKIT_BUILD_PROFILE=release pyodide build -o "$WORK/dist" .)
  cp "$WORK"/dist/qiskit-"$V"-*.whl "$OUT/"
done

# Pure-Python and official wasm dependencies are vendored too, so a run never depends on PyPI.
python -I "$TOOLS/vendor_deps.py" "$OUT" "$PYODIDE_VERSION" "$@"
python -I "$TOOLS/make_index.py" "$REPO/public/runtimes" "$PYODIDE_VERSION"
