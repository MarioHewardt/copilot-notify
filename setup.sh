#!/usr/bin/env bash
# Copilot Webhook Notifier — one-liner setup
# Usage:
#   curl -sL https://raw.githubusercontent.com/MarioHewardt/copilot-notify/main/setup.sh | bash
#
# Downloads .github/hooks/copilot-notify.json and scripts/copilot-notify.mjs
# into the current directory.

set -e

REPO="MarioHewardt/copilot-notify"
BRANCH="main"
BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}"

echo "🔔 Copilot Webhook Notifier — installing into $(pwd)"
echo ""

# Create directories
mkdir -p .github/hooks
mkdir -p scripts

# Download files
echo "  Downloading .github/hooks/copilot-notify.json..."
curl -sL "${BASE}/.github/hooks/copilot-notify.json" -o .github/hooks/copilot-notify.json

echo "  Downloading scripts/copilot-notify.mjs..."
curl -sL "${BASE}/scripts/copilot-notify.mjs" -o scripts/copilot-notify.mjs

echo ""
echo "✅ Installed! Next steps:"
echo ""
echo "  1. Set your webhook URL:"
echo ""
echo "     # PowerShell"
echo '     [Environment]::SetEnvironmentVariable("WEBHOOK_URL", "https://your-webhook-url", "User")'
echo ""
echo "     # Bash"
echo '     export WEBHOOK_URL="https://your-webhook-url"'
echo ""
echo "  2. Restart VS Code"
echo ""
echo "  The hook fires automatically whenever Copilot invokes a tool."
echo "  Docs: https://github.com/${REPO}"
