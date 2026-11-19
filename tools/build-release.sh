#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_DIR="$ROOT/release"
VERSION="$(node -p "require('$ROOT/manifest.json').version")"
ARCHIVE="$RELEASE_DIR/mcn-zhihu-chrome-v$VERSION.zip"

cd "$ROOT"
node tools/smoke-test.js
node --check scripts/content.js
node --check scripts/page-bridge.js
node --check popup/popup.js

mkdir -p "$RELEASE_DIR"
rm -f "$ARCHIVE"
zip -q -r "$ARCHIVE" \
  manifest.json \
  scripts \
  styles \
  popup \
  icons \
  source \
  README.md \
  NOTICE.md \
  LICENSE

shasum -a 256 "$ARCHIVE" > "$ARCHIVE.sha256"
printf 'Built %s\n' "$ARCHIVE"
