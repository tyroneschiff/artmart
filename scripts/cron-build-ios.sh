#!/bin/bash
export PATH="/opt/homebrew/bin:/Users/tyschiff/.local/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="/Users/tyschiff"

APP_DIR="/Users/tyschiff/artmart/app"
STAMP_FILE="/tmp/drawup-last-build-stamp"
LOG="/tmp/drawup-build.log"

echo "[$(date)] Checking for changes since last build..." >> "$LOG"

# Check if any app source files changed since last build
if [ -f "$STAMP_FILE" ]; then
  CHANGED=$(find "$APP_DIR/app" "$APP_DIR/lib" "$APP_DIR/components" "$APP_DIR/hooks" \
    -newer "$STAMP_FILE" -name "*.ts" -o -name "*.tsx" 2>/dev/null | head -1)
  if [ -z "$CHANGED" ]; then
    echo "[$(date)] No source changes detected, skipping build." >> "$LOG"
    exit 0
  fi
  echo "[$(date)] Changes detected, starting build..." >> "$LOG"
else
  echo "[$(date)] No previous build stamp, building now..." >> "$LOG"
fi

# Increment iOS build number in app.json
CURRENT=$(python3 -c "import json; d=json.load(open('$APP_DIR/app.json')); print(d['expo']['ios'].get('buildNumber','1'))")
NEXT=$((CURRENT + 1))
python3 -c "
import json
with open('$APP_DIR/app.json') as f: d = json.load(f)
d['expo']['ios']['buildNumber'] = str($NEXT)
with open('$APP_DIR/app.json', 'w') as f: json.dump(d, f, indent=2)
"
echo "[$(date)] Bumped build number to $NEXT" >> "$LOG"

# Build
cd "$APP_DIR"
/opt/homebrew/bin/eas build --platform ios --profile preview --non-interactive >> "$LOG" 2>&1
BUILD_EXIT=$?

if [ $BUILD_EXIT -ne 0 ]; then
  echo "[$(date)] Build FAILED (exit $BUILD_EXIT)" >> "$LOG"
  exit 1
fi

echo "[$(date)] Build succeeded, submitting to TestFlight..." >> "$LOG"

# Submit latest build
/opt/homebrew/bin/eas submit --platform ios --latest --non-interactive >> "$LOG" 2>&1
SUBMIT_EXIT=$?

if [ $SUBMIT_EXIT -ne 0 ]; then
  echo "[$(date)] Submit FAILED (exit $SUBMIT_EXIT)" >> "$LOG"
  exit 1
fi

# Update stamp only on full success
touch "$STAMP_FILE"
echo "[$(date)] Build $NEXT submitted to TestFlight successfully." >> "$LOG"
