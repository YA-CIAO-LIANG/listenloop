#!/bin/zsh
# Disables and removes the schedule (D65). Logs are kept.
DEST="$HOME/Library/LaunchAgents/com.listenloop.auto-continue.plist"
launchctl bootout "gui/$(id -u)/com.listenloop.auto-continue" 2>/dev/null
rm -f "$DEST"
rmdir "$HOME/Library/Application Support/listenloop-auto/lock" 2>/dev/null
echo "Removed. Logs stay in ~/Library/Logs/listenloop-auto/"
