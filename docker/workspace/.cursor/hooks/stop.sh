#!/bin/bash
# Cursor hook: Runs when Cursor stops
# Performs session cleanup

HOOKS_JSON=".cursor/hooks.json"
if [ ! -f "$HOOKS_JSON" ]; then
  exit 0
fi

CANDIDATE_ID=$(grep -o '"candidateId": "[^"]*' "$HOOKS_JSON" | cut -d'"' -f4)

if [ -n "$CANDIDATE_ID" ]; then
  LOG_FILE=".cursor/logs/session.log"
  echo "[$(date -Iseconds)] Session ended for candidate: $CANDIDATE_ID" >> "$LOG_FILE"
fi

exit 0

