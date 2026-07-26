#!/usr/bin/env zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
PLIST_SRC="$ROOT_DIR/config/com.openai.job-watch-agent.plist.example"
PLIST_DEST="$HOME/Library/LaunchAgents/com.openai.job-watch-agent.plist"

mkdir -p "$ROOT_DIR/data"
sed "s#__PROJECT_DIR__#$ROOT_DIR#g" "$PLIST_SRC" > "$PLIST_DEST"
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo "Installed launchd job: $PLIST_DEST"
echo "Logs:"
echo "  $ROOT_DIR/data/launchd.out.log"
echo "  $ROOT_DIR/data/launchd.err.log"
