#!/bin/bash
# Diagnostic script to find ALL Copilot references

echo "=========================================="
echo "COPILOT DIAGNOSTIC SCRIPT"
echo "=========================================="

echo ""
echo "1. Searching for Copilot directories..."
find / -type d -iname "*copilot*" 2>/dev/null | head -20

echo ""
echo "2. Searching for Copilot files..."
find / -type f -iname "*copilot*" 2>/dev/null | head -20

echo ""
echo "3. Searching for chat directories..."
find /usr/lib/code-server -type d -iname "*chat*" 2>/dev/null

echo ""
echo "4. Checking product.json..."
find /usr/lib/code-server -name "product.json" -exec cat {} \; 2>/dev/null | jq .

echo ""
echo "5. Checking for built-in extensions..."
find /usr/lib/code-server -name "builtInExtensions.json" -exec cat {} \; 2>/dev/null

echo ""
echo "6. Checking VS Code workbench HTML..."
find /usr/lib/code-server -name "workbench.html" -exec grep -i "copilot\|chat" {} \; 2>/dev/null

echo ""
echo "7. Listing all extensions..."
find /usr/lib/code-server -path "*/extensions/*" -maxdepth 3 -type d 2>/dev/null | grep -v node_modules | head -30

echo ""
echo "8. Checking VS Code main JavaScript bundles..."
find /usr/lib/code-server -name "*.js" -path "*/out/*" -exec grep -l "copilot\|github-copilot" {} \; 2>/dev/null | head -10

echo ""
echo "9. Checking package.json files for Copilot dependencies..."
find /usr/lib/code-server -name "package.json" -exec grep -l "copilot" {} \; 2>/dev/null

echo ""
echo "=========================================="
echo "DIAGNOSTIC COMPLETE"
echo "=========================================="
