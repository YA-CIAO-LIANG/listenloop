#!/bin/zsh
# Puts the launchd file in place (D65) without enabling it. Joe runs this
# himself; see docs/auto-continue.md.
set -e
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="$HOME/Library/LaunchAgents/com.listenloop.auto-continue.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs/listenloop-auto"
sed -e "s#__REPO__#$REPO#g" -e "s#__HOME__#$HOME#g" \
  "$REPO/scripts/auto-continue/com.listenloop.auto-continue.plist" > "$DEST"
plutil -lint "$DEST"
echo "Installed (not enabled): $DEST"
echo "Enable:  launchctl bootstrap gui/\$(id -u) $DEST"
