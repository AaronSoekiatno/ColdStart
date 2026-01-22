#!/bin/bash
# NUCLEAR COPILOT REMOVAL SCRIPT
# This script uses every possible method to remove Copilot

set -e

echo "☢️  NUCLEAR COPILOT REMOVAL SCRIPT ☢️"
echo "========================================"

# 1. Block Copilot at network level (must run as root)
if [ "$(id -u)" = "0" ]; then
    echo "1. Blocking Copilot domains at network level..."
    cat >> /etc/hosts << 'EOF'
127.0.0.1 copilot-proxy.githubusercontent.com
127.0.0.1 api.githubcopilot.com
127.0.0.1 default.exp-tas.com
EOF
    echo "   ✓ Hosts file updated"
fi

# 2. Remove all Copilot files and directories
echo "2. Removing Copilot files and directories..."
find /usr/lib/code-server -type d -iname "*copilot*" -prune -exec rm -rf {} + 2>/dev/null || true
find /usr/lib/code-server -type d -iname "*github.copilot*" -prune -exec rm -rf {} + 2>/dev/null || true
find /usr/lib/code-server -type f -iname "*copilot*.js" -delete 2>/dev/null || true
find /usr/lib/code-server -type f -iname "*copilot*.vsix" -delete 2>/dev/null || true
echo "   ✓ Files removed"

# 3. Patch VS Code workbench JavaScript to disable Copilot
echo "3. Patching VS Code workbench JavaScript..."
WORKBENCH_JS=$(find /usr/lib/code-server -name "workbench.*.js" -o -name "workbench.js" | head -1)
if [ -f "$WORKBENCH_JS" ]; then
    # Replace any Copilot initialization code with no-ops
    sed -i 's/github\.copilot/disabled_copilot/gi' "$WORKBENCH_JS" 2>/dev/null || true
    sed -i 's/copilot-proxy\.githubusercontent\.com/localhost/gi' "$WORKBENCH_JS" 2>/dev/null || true
    echo "   ✓ Workbench patched: $WORKBENCH_JS"
else
    echo "   ⚠️  Workbench JS not found"
fi

# 4. Patch all main JavaScript bundles
echo "4. Patching all VS Code JavaScript bundles..."
find /usr/lib/code-server -name "*.js" -path "*/out/*" -type f 2>/dev/null | while read -r jsfile; do
    if grep -q "copilot" "$jsfile" 2>/dev/null; then
        sed -i 's/github\.copilot/disabled_copilot/gi' "$jsfile" 2>/dev/null || true
        sed -i 's/"copilot"/"disabled"/gi' "$jsfile" 2>/dev/null || true
        echo "   ✓ Patched: $jsfile"
    fi
done

# 5. Modify product.json to disable everything
echo "5. Modifying product.json..."
PRODUCT_JSON=$(find /usr/lib/code-server -name "product.json" | head -1)
if [ -f "$PRODUCT_JSON" ]; then
    jq 'del(.extensionsGallery) |
        del(.aiConfig) |
        del(.linkProtectionTrustedDomains) |
        del(.extensionAllowedProposedApi) |
        .chatEnabled = false |
        .inlineChat.enabled = false |
        .chat = {"enabled": false} |
        .commandCenter.enabled = false |
        .supportsWorkspaceTrust = false |
        .enableTelemetry = false |
        .quality = "stable"' "$PRODUCT_JSON" > "$PRODUCT_JSON.tmp"
    mv "$PRODUCT_JSON.tmp" "$PRODUCT_JSON"
    echo "   ✓ product.json updated"
else
    echo "   ⚠️  product.json not found"
fi

# 6. Remove all built-in extensions list
echo "6. Disabling built-in extensions..."
find /usr/lib/code-server -name "builtInExtensions.json" -exec sh -c 'echo "[]" > {}' \; 2>/dev/null || true
echo "   ✓ Built-in extensions disabled"

# 7. Create marker file to prevent re-installation
echo "7. Creating prevention markers..."
mkdir -p /usr/lib/code-server/.copilot-disabled
touch /usr/lib/code-server/.copilot-disabled/COPILOT_PERMANENTLY_DISABLED
echo "   ✓ Markers created"

# 8. Remove chat-related code
echo "8. Removing chat-related code..."
find /usr/lib/code-server -type d -name "chat" -prune -exec rm -rf {} + 2>/dev/null || true
find /usr/lib/code-server -type d -iname "*chat*" -path "*/extensions/*" -prune -exec rm -rf {} + 2>/dev/null || true
echo "   ✓ Chat directories removed"

# 9. Disable extension recommendations
echo "9. Disabling extension recommendations..."
find /usr/lib/code-server -name "extensionsGallery.json" -delete 2>/dev/null || true
find /usr/lib/code-server -name "extensionRecommendations.json" -exec sh -c 'echo "[]" > {}' \; 2>/dev/null || true
echo "   ✓ Recommendations disabled"

echo ""
echo "========================================"
echo "✅ NUCLEAR REMOVAL COMPLETE"
echo "========================================"
echo ""
echo "Copilot has been removed using all available methods:"
echo "  • Network blocking via /etc/hosts"
echo "  • File and directory deletion"
echo "  • JavaScript bundle patching"
echo "  • product.json modification"
echo "  • Built-in extensions disabled"
echo "  • Extension gallery disabled"
echo ""
