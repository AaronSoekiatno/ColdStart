#!/bin/bash
# run-tests.sh
# Execute assessment tests inside the container
# Usage: ./run-tests.sh [quick|full]

set -e

MODE="${1:-quick}"
WORKSPACE_DIR="${WORKSPACE_DIR:-/workspace}"
RESULTS_FILE="$WORKSPACE_DIR/test-results.json"

echo "🚀 Starting assessment tests (Mode: $MODE)..."
cd "$WORKSPACE_DIR"

# Ensure we have the necessary environment
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found in $WORKSPACE_DIR"
    exit 1
fi

# Clean previous results
rm -f "$RESULTS_FILE"

# Define test command based on mode
if [ "$MODE" == "full" ]; then
    # Full validation: Run all tests including build verification
    echo "Running FULL validation suite..."
    # We use a custom timeout for full tests as build can take time
    npm test -- --reporter=json --outputFile="$RESULTS_FILE" --run
else
    # Quick validation: Skip the slow build test
    echo "Running QUICK validation suite..."
    npm test -- --exclude "**/build.test.ts" --reporter=json --outputFile="$RESULTS_FILE" --run
fi

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Tests passed successfully!"
else
    echo "⚠️  Some tests failed. Checking results..."
fi

# Ensure the results file exists even if tests crashed (create empty error json if missing)
if [ ! -f "$RESULTS_FILE" ]; then
    echo "{\"numTotalTestSuites\": 0, \"numPassedTestSuites\": 0, \"numFailedTestSuites\": 0, \"testResults\": [], \"success\": false, \"message\": \"Test runner crashed without producing output\"}" > "$RESULTS_FILE"
fi

# Output the results file content for the caller to capture if needed
# (or they can read the file directly)
echo "" # Ensure newline separator
echo "___JSON_START___"
cat "$RESULTS_FILE"
echo "___JSON_END___"

exit $EXIT_CODE
