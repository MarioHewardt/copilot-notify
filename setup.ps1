# Copilot Webhook Notifier — one-liner setup (PowerShell)
# Usage:
#   irm https://raw.githubusercontent.com/MarioHewardt/copilot-notify/main/setup.ps1 | iex

$repo = "MarioHewardt/copilot-notify"
$branch = "main"
$base = "https://raw.githubusercontent.com/$repo/$branch"

Write-Host "`n🔔 Copilot Webhook Notifier — installing into $PWD`n" -ForegroundColor Cyan

# Create directories
New-Item -ItemType Directory -Force -Path ".github/hooks" | Out-Null
New-Item -ItemType Directory -Force -Path "scripts" | Out-Null

# Download files
Write-Host "  Downloading .github/hooks/copilot-notify.json..."
Invoke-RestMethod "$base/.github/hooks/copilot-notify.json" -OutFile ".github/hooks/copilot-notify.json"

Write-Host "  Downloading scripts/copilot-notify.mjs..."
Invoke-RestMethod "$base/scripts/copilot-notify.mjs" -OutFile "scripts/copilot-notify.mjs"

Write-Host "`n✅ Installed! Next steps:`n" -ForegroundColor Green
Write-Host "  1. Set your webhook URL:"
Write-Host ""
Write-Host '     [Environment]::SetEnvironmentVariable("WEBHOOK_URL", "https://your-webhook-url", "User")' -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Restart VS Code"
Write-Host ""
Write-Host "  The hook fires automatically whenever Copilot invokes a tool."
Write-Host "  Docs: https://github.com/$repo`n"
