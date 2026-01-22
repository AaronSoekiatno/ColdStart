#!/bin/bash
# Patch VS Code workbench.html to block Copilot loading

echo "🔧 Patching workbench.html to block Copilot..."

WORKBENCH_HTML=$(find /usr/lib/code-server -name "workbench.html" 2>/dev/null | head -n 1)

if [ ! -f "$WORKBENCH_HTML" ]; then
    echo "   ⚠️  workbench.html not found"
    exit 0
fi

# Create backup if not exists
if [ ! -f "$WORKBENCH_HTML.backup" ]; then
    cp "$WORKBENCH_HTML" "$WORKBENCH_HTML.backup"
fi

# Inject blocking script at the very beginning of <head>
cat > /tmp/copilot-blocker.js << 'BLOCKER_EOF'
<script>
(function() {
    'use strict';
    console.log('[HERMES] Copilot blocker loaded');

    // Override XMLHttpRequest to block Copilot API calls
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (url && (
            url.includes('copilot') ||
            url.includes('githubcopilot') ||
            url.includes('copilot-proxy')
        )) {
            console.log('[HERMES] Blocked Copilot request:', url);
            return;
        }
        return originalOpen.call(this, method, url, ...rest);
    };

    // Override fetch to block Copilot API calls
    const originalFetch = window.fetch;
    window.fetch = function(url, ...rest) {
        if (url && (
            url.includes('copilot') ||
            url.includes('githubcopilot') ||
            url.includes('copilot-proxy')
        )) {
            console.log('[HERMES] Blocked Copilot fetch:', url);
            return Promise.reject(new Error('Copilot blocked by Hermes'));
        }
        return originalFetch.call(this, url, ...rest);
    };

    // Block dynamic imports of Copilot
    const originalImport = window.import || (async () => {});
    if (window.import) {
        window.import = async function(url) {
            if (url && url.includes('copilot')) {
                console.log('[HERMES] Blocked Copilot import:', url);
                throw new Error('Copilot blocked by Hermes');
            }
            return originalImport.call(this, url);
        };
    }

    // Prevent Copilot service registration
    if (window.navigator && window.navigator.serviceWorker) {
        const originalRegister = window.navigator.serviceWorker.register;
        window.navigator.serviceWorker.register = async function(url, ...rest) {
            if (url && url.includes('copilot')) {
                console.log('[HERMES] Blocked Copilot service worker:', url);
                throw new Error('Service worker blocked by Hermes');
            }
            return originalRegister.call(this, url, ...rest);
        };
    }

    // Continuously hide Copilot UI elements
    function hideCopilotUI() {
        const style = document.getElementById('hermes-copilot-blocker-style') || document.createElement('style');
        style.id = 'hermes-copilot-blocker-style';
        style.textContent = `
            .part.sidebar.right,
            .sidebar.right,
            [id*="copilot"],
            [id*="chat"],
            [class*="copilot"],
            [class*="github-copilot"],
            [aria-label*="Copilot"],
            [aria-label*="Chat"],
            [title*="Copilot"],
            .codicon-copilot,
            .codicon-comment-discussion {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                position: absolute !important;
                left: -99999px !important;
            }
        `;
        if (!style.parentNode) {
            document.head.appendChild(style);
        }

        // Remove elements
        const selectors = [
            '.part.sidebar.right',
            '[id*="copilot"]',
            '[id*="chat"]',
            '[aria-label*="Copilot"]',
            '[aria-label*="Chat"]'
        ];
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (el && el.remove) {
                    el.remove();
                }
            });
        });
    }

    // Run immediately and continuously
    hideCopilotUI();
    setInterval(hideCopilotUI, 500);

    // Observer for DOM changes
    if (window.MutationObserver) {
        const observer = new MutationObserver(hideCopilotUI);
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // Run on various load events
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideCopilotUI);
    }
    window.addEventListener('load', hideCopilotUI);

    console.log('[HERMES] Copilot blocker active');
})();
</script>
BLOCKER_EOF

# Inject the script right after <head>
if ! grep -q "HERMES.*Copilot blocker" "$WORKBENCH_HTML"; then
    sed -i "s|<head>|<head>$(cat /tmp/copilot-blocker.js | tr -d '\n')|" "$WORKBENCH_HTML"
    echo "   ✓ Copilot blocker injected into workbench.html"
else
    echo "   ℹ️  Copilot blocker already present"
fi

rm -f /tmp/copilot-blocker.js
echo "   ✓ Workbench patching complete"
